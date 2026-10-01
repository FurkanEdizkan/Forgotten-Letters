/**
 * The warband-building rules of the books, as pure functions the builder (and its tests) can run:
 * what a warband starts with, what a model may be given, who may be recruited, and what makes a list illegal.
 *
 * Sources: Warbands of Trench Crusade, "Starting a Warband" (700 Ducats, at most 6 ELITE, stipulations) and
 * each Faction List's special rules; Trench Crusade Rulebook, "Battlekit Limits" (hands, one armour, …).
 * The facts are read from the imported rules text, so a correction in Admin → Rules corrects the builder.
 */
import type { Currency } from './roster';
import { limitIssues, loadoutCheck, matchModel, newlyBroken, matchItem, type Limit, type LimitWorld, type Loadout, type ModelSel, type PriceRule, type ScopedLimit } from './warband-limits';

export type ArmouryCategory = 'ranged' | 'grenade' | 'melee' | 'armour' | 'shield' | 'equipment' | 'special';

export const letters = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
/** "yeomen" → "yeoman", "sorceries" → "sorcery", "pilgrims" → "pilgrim" (names already run through `letters`). */
const singular = (s: string) => s.replace(/men$/, 'man').replace(/ies$/, 'y').replace(/(ch|sh|x|ss)es$/, '$1').replace(/s$/, '');
/**
 * Two names for the same entry: equal but for a plural ("Yeomen" is the Yeoman entry). Never one inside the other:
 * "Heretic Raiders" is not "Anointed Heretic Raiders".
 */
export const sameEntry = (a: string, b: string) => singular(letters(a)) === singular(letters(b));
/** "a Gas Mask" → "Gas Mask"; "a suit of Infernal Iron Armour" → "Infernal Iron Armour". */
const bare = (s: string) =>
	s
		.replace(/\(▶[^)]*\)?/g, '')
		.replace(/^\s*(?:and\s+)?(?:(?:a suit of|a pair of|an?|the|two|one)\s+)+/i, '')
		.replace(/\s+(?:with|from|for)\s+.*$/i, '')
		.trim();

// ---------------------------------------------------------------- items

export interface ArmouryItem {
	id?: string;
	name: string;
	category: ArmouryCategory;
	cost: number;
	currency: Currency;
	limit: number | null;
	restrictions: string | null;
	type: string | null;
	range: string | null;
	keywords: string[];
	variant?: string | null;
	/** The item's special rules text. */
	text?: string | null;
	/** Stipulations set by hand in the Faction Studio; they win over the restrictions text. */
	stipulations?: StipulationsOverride | null;
}

/** Hand-set stipulations (Faction Studio / template): any key given replaces what the text says. */
export interface StipulationsOverride {
	only?: string[];
	perModel?: number | null;
	shieldCombo?: boolean;
	bayonetLug?: boolean;
	consumable?: boolean;
	headgear?: boolean;
	explorationOnly?: boolean;
	/** Items any warband may get (Glory Items, exploration finds): only warbands of this alignment, or these factions. */
	alignment?: 'faithful' | 'fallen';
	factions?: string[];
	hands?: 0 | 1 | 2;
	dual?: boolean;
	/** Limits on the models that carry it ("cannot also carry a Trench Shield"). */
	limits?: Limit[];
	/** Models whose copies don't count towards its `limit`. */
	limitExcludes?: ModelSel;
}

export interface ItemFacts {
	hands: 0 | 1 | 2;
	/** Dual-purpose kit (a range and "Melee") counts once, as the weapon it is filed under. */
	dual: boolean;
	/** "X only": the model must be (or have the keyword) X. Empty = anyone. */
	only: string[];
	perModel: number | null;
	shieldCombo: boolean;
	bayonetLug: boolean;
	consumable: boolean;
	headgear: boolean;
	cumbersome: boolean;
	heavy: boolean;
	held: boolean;
	explorationOnly: boolean;
	limits?: Limit[];
	limitExcludes?: ModelSel;
}

const STIPULATIONS = /^(shield combo|bayonet lug|consumable|headgear|limit.*|\d+ per model|exploration only)$/i;

export function itemFacts(i: ArmouryItem): ItemFacts {
	const r = i.restrictions ?? '';
	const kw = i.keywords.map((k) => k.toUpperCase());
	const tokens = r
		.replace(/\((\d+) per model\)/i, ',$1 per model')
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
	// "Mechanized Heavy Infantry, ELITE only" means either of them; every non-stipulation token names who may take it.
	const only = tokens.filter((t) => !STIPULATIONS.test(t)).map((t) => t.replace(/\s+only$/i, '').trim()).filter(Boolean);
	const perModel = r.match(/(\d+) per model/i);
	const t = (i.type ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
	return {
		hands: t.includes('2handed') ? 2 : t.includes('1handed') ? 1 : 0,
		dual: /\d/.test(i.range ?? '') && /melee/i.test(i.range ?? ''),
		only,
		perModel: perModel ? Number(perModel[1]) : null,
		shieldCombo: /shield combo/i.test(r) || kw.includes('SHIELD COMBO'),
		bayonetLug: /bayonet lug/i.test(r) || kw.includes('BAYONET LUG'),
		consumable: /consumable/i.test(r) || kw.includes('CONSUMABLE'),
		headgear: /headgear/i.test(r) || kw.includes('HEADGEAR'),
		cumbersome: kw.includes('CUMBERSOME'),
		heavy: kw.includes('HEAVY'),
		held: kw.includes('HELD'),
		explorationOnly: /exploration only/i.test(r),
		...definedOnly(i.stipulations ?? {})
	} as ItemFacts;
}

/** An override's keys that are actually set (so `undefined` never blanks a parsed fact). */
function definedOnly<T extends object>(o: T): Partial<T> {
	return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ---------------------------------------------------------------- units

export interface UnitKit {
	/** Battlekit the model always has, free and permanent. */
	fixed: string[];
	/** "either Reinforced Armour at cost of 85, or Machine Armour at a cost of 95": the second is an upgrade. */
	swap: { from: string; to: string; extra: number } | null;
	/** Armoury categories it may not take ("apart from Armour", "except for Ranged Weapons or Grenades"). */
	except: ArmouryCategory[];
	/** "cannot have any other Battlekit". */
	nothingElse: boolean;
	/** Armoury items this entry buys at its own price (see `UnitKitOverride.prices`). */
	prices?: Record<string, { cost: number; currency: Currency }>;
	/** The entry's own limits (see `UnitKitOverride`). */
	limits?: Limit[];
	hands?: { ranged?: number; melee?: number };
	loadouts?: Loadout[];
	countsAs?: string;
	recruit?: boolean;
	items?: Record<string, StipulationsOverride>;
}

const CATEGORY_WORDS: [RegExp, ArmouryCategory][] = [
	[/ranged weapons?/i, 'ranged'],
	[/melee weapons?/i, 'melee'],
	[/grenades?/i, 'grenade'],
	[/shields?/i, 'shield'],
	[/armour/i, 'armour'],
	[/equipment/i, 'equipment']
];

/** Hand-set builder facts for a unit (Faction Studio / template). */
export interface UnitKitOverride {
	fixed?: string[];
	except?: ArmouryCategory[];
	nothingElse?: boolean;
	swap?: { from: string; to: string; extra: number } | null;
	hire?: { alignment: 'faithful' | 'fallen' | null; by: string[] } | null;
	/** What an armoury item costs this entry, where its own entry says so ("can take a Rifle for 5 ducats"). By item name. */
	prices?: Record<string, { cost: number; currency: 'ducats' | 'glory' }>;
	/** Limits on this entry's models ("may only take these items", "must carry Armour", "at most 2 Goetic Powers"). */
	limits?: Limit[];
	/** Weapons it can hold, in hands, where its entry gives it more (or fewer) than two. */
	hands?: { ranged?: number; melee?: number };
	/** The kit it must carry as one of these sets ("a Greatsword, or a Polearm and a Trench Shield"). */
	loadouts?: Loadout[];
	/** It is this other entry for "X only" kit and upgrades (a variant's Master Assassin is a Sultanate Assassin). */
	countsAs?: string;
	/** false: never recruited, only gained another way (resurrection). */
	recruit?: boolean;
	/** Stipulations an armoury item has when this entry carries it, by item name. */
	items?: Record<string, StipulationsOverride>;
}

export function unitKit(note: string | null | undefined, override?: UnitKitOverride | null): UnitKit {
	const parsed = parseKit(note);
	if (!override) return parsed;
	const { hire: _h, ...rest } = override;
	return { ...parsed, ...definedOnly(rest) } as UnitKit;
}

function parseKit(note: string | null | undefined): UnitKit {
	const n = (note ?? '').replace(/\s+/g, ' ');
	const kit: UnitKit = { fixed: [], swap: null, except: [], nothingElse: /cannot have any other Battlekit/i.test(n) };
	const either = n.match(/always has either (?:a |an )?(.+?) at (?:a )?cost of (\d+)[^,]*,? or (?:a |an )?(.+?) at a cost of (\d+)/i);
	if (either) {
		kit.fixed = [bare(either[1])];
		kit.swap = { from: bare(either[1]), to: bare(either[3]), extra: Number(either[4]) - Number(either[2]) };
	} else {
		const has = n.match(/always ha(?:s|ve) (.+?)(?:\.(?:\s|$)|\s*\(▶| which | This |, and (?:it )?(?:cannot|can)| These )/i);
		if (has)
			kit.fixed = has[1]
				.split(/,\s*(?:and\s+)?|\s+and\s+/)
				.map(bare)
				.filter((x) => x && !/^either\b/i.test(x));
	}
	const except = n.match(/(?:apart from|except for|other than) ([^.]+)/i);
	if (except) for (const [re, cat] of CATEGORY_WORDS) if (re.test(except[1])) kit.except.push(cat);
	return kit;
}

/** Who may hire a mercenary: "…can be recruited as a Mercenary by New Antioch and Trench Pilgrim Warbands." */
export function hiredBy(unitText: string): { alignment: 'faithful' | 'fallen' | null; by: string[] } {
	const align = unitText.match(/is (Faithful|Fallen)\b/i);
	const m = unitText.match(/recruited as a Mercenary by ([^.]+)\./i);
	const by = m
		? m[1]
				.replace(/\bWarbands?\b/gi, '')
				.split(/,|\band\b/)
				.map((s) => s.replace(/^\s*the\s+/i, '').trim())
				.filter(Boolean)
		: [];
	return { alignment: align ? (align[1].toLowerCase() as 'faithful' | 'fallen') : null, by };
}

// ---------------------------------------------------------------- faction & variant rules

export interface Upgrade {
	/** The rule's name, as printed ("Swiss Guard"). */
	name: string;
	/** The keyword it grants, if any. */
	keyword: string | null;
	/** How many models may take it (null: any). */
	max: number | null;
	cost: number;
	currency: Currency;
	/** Entry names it applies to (empty: any model). */
	for: string[];
	text: string;
	/** More keywords it grants. */
	keywords?: string[];
	/** The kind of upgrade it is ("Goetic Power"), for limits that count them together. */
	group?: string;
	/** Hands the model has with it. */
	hands?: { ranged?: number; melee?: number };
	/** Limits on the models that have it ("cannot take Ranged Weapons"). */
	limits?: Limit[];
}

/** Hand-set rules for a faction or variant (Faction Studio / template); any key given replaces the parsed one. */
export type RulesOverride = Partial<Omit<VariantRules, 'paragraphs'>>;

export interface VariantRules {
	startDucats: number;
	startGlory: number;
	alignment: 'faithful' | 'fallen' | null;
	/** Entries the warband cannot include. */
	excluded: string[];
	/** Entries it must include (at least n). */
	mustInclude: { name: string; n: number }[];
	/** The entry that is the warband's Leader instead of the usual one. */
	leader: string | null;
	/** Entries whose usual "must include" is lifted ("does not have to include a Lieutenant"). */
	optional: string[];
	/** "can only include 0-2 X": a lower cap on an entry. */
	caps: { name: string; max: number }[];
	/** Battlekit given free when the warband is created. */
	freeItems: string[];
	upgrades: Upgrade[];
	fireteams: number;
	/** The Patron the warband must serve ("a Knights of Avarice warband worships Mammon"). */
	patron: string | null;
	/** A warband of this faction must be one of its variants (a Court warband is dedicated to a Sin). */
	requiresVariant: boolean;
	/** The books' other building limits (see warband-limits.ts). */
	limits: Limit[];
	/** Prices set by rule (the first copy at half price, a Patron Skill's discount). */
	prices: PriceRule[];
	/** The rule text, one paragraph per rule, for the Faction Special Rules panel. */
	paragraphs: string[];
}

/** Entry names in a list ("Trench Moles or Sniper Priests"); prose fragments are dropped. */
const names = (s: string) =>
	s
		.split(/,|\bor\b|\band\b/)
		.map((x) => bare(x).replace(/^(?:any|more than \d+)\s+/i, '').trim())
		.filter((x) => /^[A-Z]/.test(x) && x.split(/\s+/).length <= 5 && !/[.;:]/.test(x));

/** Read a faction's and (optionally) a variant's special rules into builder facts. */
export function readRules(
	factionText: string | null | undefined,
	variantText?: string | null,
	overrides: (RulesOverride | null | undefined)[] = []
): VariantRules {
	const r = parseRules(factionText, variantText);
	// The first hand-set value of a field replaces what was read from the text; later ones (a variant's, over its
	// faction's) add to lists rather than replacing them: upgrades and caps by name (the later one wins), exclusions,
	// free items and lifted must-includes together. Everything else, the later one wins.
	const set = new Set<string>();
	const out = r as unknown as Record<string, unknown>;
	const byName = <T extends { name: string }>(a: T[], b: T[]) => [...a.filter((x) => !b.some((y) => letters(y.name) === letters(x.name))), ...b];
	const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.some((y) => letters(y) === letters(x)))];
	for (const o of overrides) {
		if (!o) continue;
		for (const [k, v] of Object.entries(definedOnly(o)) as [keyof VariantRules, never][]) {
			const first = !set.has(k);
			set.add(k);
			if (first) out[k] = v;
			else if (k === 'upgrades' || k === 'caps') out[k] = byName(r[k] as { name: string }[], v);
			// Limits and prices: a later one of the same name replaces it; unnamed ones add up.
			else if (k === 'limits' || k === 'prices') {
				const later = v as { name?: string }[];
				out[k] = [...(r[k] as { name?: string }[]).filter((x) => !x.name || !later.some((y) => y.name && letters(y.name) === letters(x.name!))), ...later];
			}
			else if (k === 'excluded' || k === 'freeItems' || k === 'optional') out[k] = union(r[k] as string[], v);
			else out[k] = v;
		}
	}
	// A variant takes away a faction's upgrade by excluding it by name.
	r.upgrades = r.upgrades.filter((u) => !r.excluded.some((x) => letters(x) === letters(u.name)));
	return r;
}

function parseRules(factionText: string | null | undefined, variantText?: string | null): VariantRules {
	const all = [factionText ?? '', variantText ?? ''].join('\n\n');
	const money = (t: string) => t.match(/You have (\d+)\s*👑(?:\s*and\s*(\d+)\s*☼)?/);
	const m = money(variantText ?? '') ?? money(factionText ?? '');
	const r: VariantRules = {
		startDucats: m ? Number(m[1]) : 700,
		startGlory: m?.[2] ? Number(m[2]) : 0,
		alignment: /are Faithful/i.test(all) ? 'faithful' : /are Fallen/i.test(all) ? 'fallen' : null,
		excluded: [],
		mustInclude: [],
		leader: null,
		optional: [],
		caps: [],
		freeItems: [],
		upgrades: [],
		fireteams: 0,
		patron: null,
		requiresVariant: false,
		limits: [],
		prices: [],
		paragraphs: all
			.split(/\n{2,}/)
			.map((p) => p.trim())
			.filter(Boolean)
	};
	for (const x of all.matchAll(/cannot include ([^.]+?)(?:\.|;| but )/gi)) r.excluded.push(...names(x[1]));
	for (const x of all.matchAll(/must include (\d+) ([A-Z][\w’'\- ]+?)(?:[,.;]| but | and )/g)) r.mustInclude.push({ name: bare(x[2]), n: Number(x[1]) });
	for (const x of all.matchAll(/does not have to include (?:a |an )?([A-Z][\w’'\- ]+?)[,.]/g)) r.optional.push(bare(x[1]));
	const leader = all.match(/An? ([A-Z][\w’'\- ]+?) in an? [^.]*? has the LEADER Keyword/);
	if (leader) r.leader = bare(leader[1]);
	for (const x of all.matchAll(/can only include (\d+)-(\d+) ([A-Z][\w’'\- ]+?)(?:[,.]| and )/g)) r.caps.push({ name: bare(x[3]), max: Number(x[2]) });
	const free = all.match(/you must give (?:the |a |an )?(.+?) to one model/i);
	if (free && /free/i.test(all)) r.freeItems.push(bare(free[1]));
	const ft = all.match(/can include up to (\d+) Fireteams/i);
	if (ft) r.fireteams = Number(ft[1]);
	// Keyword upgrades: "* Swiss Guard: The Lieutenant and up to 4 models … can have the NEGATE FEAR Keyword at no additional cost".
	for (const p of r.paragraphs) {
		const rule = p.match(/^\*?\s*([^:]{2,40}):\s*(.+)$/s);
		if (!rule) continue;
		const up = rule[2].match(/(?:The ([A-Z][\w ]+?) and )?up to (\d+) models? [^.]*?can have the ([A-Z][A-Z ]+?) Keyword(?: at no additional cost| for (\d+))?/);
		if (up)
			r.upgrades.push({
				name: rule[1].trim(),
				keyword: up[3].trim(),
				max: Number(up[2]),
				cost: up[4] ? Number(up[4]) : 0,
				currency: 'ducats',
				for: [],
				text: rule[2].trim()
			});
	}
	return r;
}

// ---------------------------------------------------------------- checks

export interface HeldItem {
	name: string;
	cost: number;
	currency: Currency;
}
export interface ModelState {
	id: string;
	/** The entry it was recruited as (its rules name). */
	type: string;
	category: 'elite' | 'troop' | 'mercenary';
	keywords: string[];
	status: string;
	equipment: HeldItem[];
	upgrades: string[];
	kit: UnitKit;
	/** Its entry's cost with its upgrades (not its kit). */
	cost: number;
	currency: Currency;
	skills: string[];
	/** The entry it counts as for "X only" (see `UnitKitOverride.countsAs`). */
	countsAs?: string;
}
export interface WarbandState {
	models: ModelState[];
	stash: HeldItem[];
	ducats: number;
	glory: number;
	armoury: ArmouryItem[];
	unrestricted: boolean;
	/** Exploration-only kit may be bought (the CM, or "Open Exploration"). */
	openExploration?: boolean;
	/** Every building limit in force, each with the models it is about (see `builderState`). */
	limits?: ScopedLimit[];
	prices?: PriceRule[];
	upgrades?: Upgrade[];
	/** The Patron it serves. */
	patron?: string | null;
	/** Its variant, if any. */
	variant?: string | null;
}

export type Check = { ok: true } | { ok: false; reason: string };
const ok: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

/** The limits' view of a warband. */
const world = (w: WarbandState, models = w.models): LimitWorld => ({ models, armoury: w.armoury, upgrades: w.upgrades ?? [], limits: w.limits ?? [] });

function applyPrice<T extends { cost: number; currency: Currency }>(p: T, r: PriceRule): T {
	if (r.cost != null) return { ...p, cost: r.cost, currency: r.currency ?? p.currency };
	if (r.less != null) return { ...p, cost: Math.max(0, p.cost - r.less) };
	return { ...p, cost: Math.ceil(p.cost * (r.factor ?? 1)) };
}

/**
 * What an item costs this model: its entry's own price where the entry names one ("a Rifle for 5"), else the
 * armoury's; then the warband's price rules (the first copy at half price, a Patron Skill's discount).
 */
export function priceFor<T extends { name: string; cost: number; currency: Currency }>(m: { kit: UnitKit } | null | undefined, item: T, w?: WarbandState): T {
	const own = m?.kit.prices && Object.entries(m.kit.prices).find(([name]) => letters(name) === letters(item.name));
	let p: T = own ? { ...item, cost: own[1].cost, currency: own[1].currency } : item;
	if (!w) return p;
	const held = [...w.models.flatMap((x) => x.equipment), ...w.stash];
	for (const r of w.prices ?? []) {
		if (!r.items || !matchItem(item, r.items, w.armoury)) continue;
		if (r.who && !(m && 'id' in m && matchModel(m as ModelState, r.who, world(w)))) continue;
		if (r.while && !w.models.some((x) => x.status === 'active' && matchModel(x, r.while, world(w)))) continue;
		if (r.first && held.some((h) => letters(h.name) === letters(item.name))) continue;
		p = applyPrice(p, r);
	}
	return p;
}

/** What recruiting this entry costs now (its first one may cost otherwise: "the first Goetic Warlock costs 110 Ducats"). */
export function entryPrice<T extends { name: string; cost: number; currency: Currency }>(e: T, w: WarbandState): T {
	let p = e;
	for (const r of w.prices ?? []) {
		if (!r.entries?.some((x) => sameEntry(x, e.name))) continue;
		if (r.first && w.models.some((m) => m.status === 'active' && sameEntry(m.type, e.name))) continue;
		if (r.while && !w.models.some((x) => x.status === 'active' && matchModel(x, r.while, world(w)))) continue;
		p = applyPrice(p, r);
	}
	return p;
}

/** The warband's models with this one changed (or added). */
const withModel = (w: WarbandState, m: ModelState) => (w.models.some((x) => x.id === m.id) ? w.models.map((x) => (x.id === m.id ? m : x)) : [...w.models, m]);

/**
 * May this model take a keyword upgrade now: one of the entries it is for (if it names any), within its most, and
 * paid in its own currency.
 */
export function upgradeCheck(m: ModelState, up: Upgrade, w: WarbandState): Check {
	if (w.unrestricted) return ok;
	if (up.for.length && !up.for.some((x) => qualifies(m, x))) return no(`${up.name} is for ${up.for.join(', ')}`);
	const taken = w.models.filter((x) => x.status === 'active' && x.id !== m.id && x.upgrades.includes(up.name)).length;
	if (up.max != null && taken >= up.max) return no(`${up.name}: ${taken}/${up.max} taken`);
	const purse = up.currency === 'glory' ? w.glory : w.ducats;
	if (up.cost > purse) return no(`Costs ${up.cost} ${up.currency === 'glory' ? 'Glory' : 'Ducats'}; ${purse} in the strongbox`);
	const next = { ...m, upgrades: [...m.upgrades, up.name], keywords: [...m.keywords, ...[up.keyword, ...(up.keywords ?? [])].filter((k): k is string => !!k)] };
	const broken = newlyBroken(world(w), world(w, withModel(w, next)));
	return broken ? no(broken) : ok;
}

export const findItem = (armoury: ArmouryItem[], name: string) => armoury.find((a) => letters(a.name) === letters(name)) ?? null;

/** Does a model count as "X" for an "X only" stipulation: its entry, a keyword, or (for "Rifle") its weapon? */
function qualifies(m: ModelState, x: string) {
	const k = letters(x);
	if (k === 'elite') return m.category === 'elite' || m.keywords.some((w) => letters(w) === 'elite');
	if (m.countsAs && sameEntry(m.countsAs, x)) return true;
	// "Chewa only": a model that has taken that upgrade.
	if (m.upgrades.some((u) => letters(u) === k)) return true;
	if (m.keywords.some((w) => letters(w) === k)) return true;
	if (sameEntry(m.type, x)) return true;
	// "Rifle only" (a sniper scope): the model carries a rifle.
	return m.equipment.some((e) => letters(e.name).includes(k));
}

/** Hands used by a model's weapons, per the Rulebook's Battlekit Limits. */
function handsUsed(m: ModelState, armoury: ArmouryItem[], extra?: ArmouryItem) {
	const items = [...m.equipment.map((e) => findItem(armoury, e.name)).filter((x): x is ArmouryItem => !!x), ...(extra ? [extra] : [])].map((i) => asCarried(m, i));
	const strong = m.keywords.some((k) => letters(k) === 'strong');
	let ranged = 0;
	let melee = 0;
	let rangedTwo = false;
	let meleeTwo = false;
	let shield: ArmouryItem | null = null;
	const twoHanded: ArmouryItem[] = [];
	for (const i of items) {
		const f = itemFacts(i);
		if (i.category === 'shield') shield = i;
		if (i.category === 'ranged') {
			ranged += f.hands || 1;
			if (f.hands === 2) (rangedTwo = true), twoHanded.push(i);
		}
		if (i.category === 'melee') {
			const h = f.hands === 2 && strong && !f.cumbersome ? 1 : f.hands || 1;
			melee += h;
			if (h === 2) (meleeTwo = true), twoHanded.push(i);
		}
	}
	return { ranged, melee, rangedTwo, meleeTwo, shield, twoHanded, items };
}

/** Copies of an item held in the warband that count towards its Limit. */
function limitCount(item: ArmouryItem, w: WarbandState) {
	const ex = itemFacts(item).limitExcludes;
	const on = w.models.filter((x) => !ex || !matchModel(x, ex, world(w))).flatMap((x) => x.equipment);
	return [...on, ...w.stash].filter((e) => letters(e.name) === letters(item.name)).length;
}

/** The hands a model has for weapons: two, unless its entry or an upgrade says otherwise. */
function handsOf(m: ModelState, w: WarbandState) {
	const ups = (w.upgrades ?? []).filter((u) => u.hands && m.upgrades.includes(u.name));
	const pick = (k: 'ranged' | 'melee') => Math.max(m.kit.hands?.[k] ?? 2, ...ups.map((u) => u.hands?.[k] ?? 0));
	return { ranged: pick('ranged'), melee: pick('melee') };
}

/** An item as this model carries it: its entry may give it other stipulations ("its Jezzail has Shield Combo"). */
function asCarried(m: ModelState, i: ArmouryItem): ArmouryItem {
	const own = m.kit.items && Object.entries(m.kit.items).find(([name]) => letters(name) === letters(i.name))?.[1];
	return own ? { ...i, stipulations: { ...(i.stipulations ?? {}), ...own } } : i;
}

/** May this model be given this item? The first rule it breaks is the reason. */
export function equipCheck(m: ModelState, armouryItem: ArmouryItem, w: WarbandState): Check {
	const item = asCarried(m, armouryItem);
	const f = itemFacts(item);
	if (!w.unrestricted) {
		if (m.kit.nothingElse) return no(`A ${m.type} cannot have any other Battlekit`);
		if (m.kit.except.includes(item.category)) return no(`A ${m.type} cannot take ${item.category === 'armour' ? 'Armour' : item.category + ' kit'}`);
		if (f.explorationOnly && !w.openExploration) return no('Found through Exploration only');
		if (f.only.length && !f.only.some((x) => qualifies(m, x))) return no(`${f.only.join(' or ')} only`);
		if (item.limit != null && !(f.limitExcludes && matchModel(m, f.limitExcludes, world(w)))) {
			const held = limitCount(item, w);
			if (held >= item.limit) return no(`Limit ${held}/${item.limit} used`);
		}
		if (f.perModel != null && m.equipment.filter((e) => letters(e.name) === letters(item.name)).length >= f.perModel)
			return no(`${f.perModel} per model`);
		const cur = handsUsed(m, w.armoury);
		const next = handsUsed(m, w.armoury, item);
		const shield = next.shield;
		const hands = handsOf(m, w);
		if (item.category === 'ranged' && next.ranged > hands.ranged) return no(`No free hands for a ranged weapon (${cur.ranged} of ${hands.ranged} in use)`);
		if (item.category === 'melee' && next.melee > hands.melee) return no(`No free hands for a melee weapon (${cur.melee} of ${hands.melee} in use)`);
		// HEAVY: one piece per model (STRONG models negate it). HELD: one hand, so one 1-Handed Weapon or a Shield beside it.
		const strong = m.keywords.some((k) => ['strong', 'negateheavy'].includes(letters(k)));
		if (!strong && next.items.filter((i) => itemFacts(i).heavy).length > 1) return no('Only one piece of HEAVY battlekit');
		if (next.items.some((i) => itemFacts(i).held)) {
			const other = next.items.filter((i) => !itemFacts(i).held && ['ranged', 'melee', 'shield'].includes(i.category));
			if (other.length > 1) return no('With HELD battlekit, only one 1-Handed Weapon or a Shield');
			if (next.twoHanded.some((t) => !itemFacts(t).held)) return no('With HELD battlekit, no 2-Handed Weapons');
		}
		if (m.kit.loadouts?.length) {
			const bad = loadoutCheck([...m.equipment.map((e) => e.name), item.name], m.kit.loadouts, false);
			if (bad) return no(bad);
		}
		if (shield) {
			const combo = itemFacts(shield).shieldCombo;
			const bad = next.twoHanded.find((t) => !(combo && itemFacts(t).shieldCombo));
			if (bad) return no(`${bad.name} is 2-Handed and needs Shield Combo with ${shield.name}`);
			// The shield takes a hand: one 1-Handed weapon of each kind beside it (more with more hands).
			if (next.ranged > hands.ranged - 1 && !next.rangedTwo) return no(`With a Shield, only ${hands.ranged - 1 === 1 ? 'one' : hands.ranged - 1} 1-Handed ranged weapon${hands.ranged - 1 === 1 ? '' : 's'}`);
			if (next.melee > hands.melee - 1 && !next.meleeTwo) return no(`With a Shield, only ${hands.melee - 1 === 1 ? 'one' : hands.melee - 1} 1-Handed melee weapon${hands.melee - 1 === 1 ? '' : 's'}`);
		}
		const has = (cat: ArmouryCategory) => cur.items.some((i) => i.category === cat);
		if (item.category === 'grenade' && has('grenade')) return no('Only one type of Grenade');
		if (item.category === 'armour' && has('armour')) return no('Only one suit of Armour');
		if (item.category === 'shield' && has('shield')) return no('Only one Shield');
		if (f.headgear && cur.items.some((i) => itemFacts(i).headgear)) return no('Only one piece of Headgear');
		// No two of the same piece, unless the item allows more on one model.
		if ((item.category === 'equipment' || item.category === 'special') && !((f.perModel ?? 1) > 1) && m.equipment.some((e) => letters(e.name) === letters(item.name)))
			return no(`Already has ${item.name}`);
		if (letters(item.name) === 'bayonet' && !cur.items.some((i) => i.category === 'ranged' && itemFacts(i).bayonetLug))
			return no('Needs a ranged weapon with a Bayonet Lug');
		const held: HeldItem = { name: item.name, cost: item.cost, currency: item.currency };
		const broken = newlyBroken(world(w), world(w, withModel(w, { ...m, equipment: [...m.equipment, held] })));
		if (broken) return no(broken);
	}
	const purse = item.currency === 'glory' ? w.glory : w.ducats;
	if (!w.unrestricted && item.cost > purse)
		return no(`Costs ${item.cost} ${item.currency === 'glory' ? 'Glory' : 'Ducats'}; ${purse} in the strongbox`);
	return ok;
}

export interface EntryRef {
	name: string;
	category: 'elite' | 'troop' | 'mercenary';
	availabilityMax: number | null;
	cost: number;
	currency: Currency;
	keywords: string[];
	/** For mercenaries: who may hire them. */
	hire?: { alignment: 'faithful' | 'fallen' | null; by: string[] };
	/** false: never recruited (see `UnitKitOverride.recruit`). */
	recruit?: boolean;
	countsAs?: string;
}

const same = sameEntry;

/** May the warband recruit this entry now? */
export function recruitCheck(
	e: EntryRef,
	w: WarbandState,
	rules: VariantRules,
	faction: { name: string; alignment: 'faithful' | 'fallen'; variant: string | null }
): Check {
	if (w.unrestricted) return ok;
	if (e.recruit === false) return no(`A ${e.name} is not recruited; it joins another way`);
	const active = w.models.filter((m) => m.status === 'active');
	if (rules.excluded.some((x) => same(x, e.name) || (e.category === 'mercenary' && letters(x) === 'mercenaries')))
		return no(`${faction.variant ?? faction.name} cannot include ${e.category === 'mercenary' && rules.excluded.some((x) => letters(x) === 'mercenaries') ? 'Mercenaries' : e.name}`);
	if (e.category === 'mercenary' && e.hire) {
		const byName = e.hire.by.some((b) => same(b, faction.name) || (faction.variant && same(b, faction.variant)));
		// "…by Fallen Warbands", or no hiring line at all: go by alignment (none printed = anyone may hire).
		const byAlign = e.hire.by.length
			? e.hire.by.some((b) => letters(b).includes(faction.alignment))
			: !e.hire.alignment || e.hire.alignment === faction.alignment;
		if (!byName && !byAlign) return no(`Not hired by ${faction.name}`);
	}
	const fielded = active.filter((m) => same(m.type, e.name)).length;
	const cap = rules.caps.find((c) => same(c.name, e.name))?.max ?? e.availabilityMax;
	if (cap != null && fielded >= cap) return no(`Limit reached (${fielded}/${cap})`);
	const elite = e.category === 'elite' || e.keywords.some((k) => letters(k) === 'elite');
	if (elite && active.filter((m) => m.category === 'elite').length >= 6) return no('A warband can have at most 6 ELITE models');
	const price = entryPrice(e, w);
	const purse = price.currency === 'glory' ? w.glory : w.ducats;
	if (price.cost > purse) return no(`Costs ${price.cost} ${price.currency === 'glory' ? 'Glory' : 'Ducats'}; ${purse} in the strongbox`);
	const recruit: ModelState = {
		id: '(new)',
		type: e.name,
		category: e.category,
		keywords: e.keywords,
		status: 'active',
		equipment: [],
		upgrades: [],
		kit: { fixed: [], swap: null, except: [], nothingElse: false },
		cost: price.cost,
		currency: price.currency,
		skills: [],
		countsAs: e.countsAs
	};
	const broken = newlyBroken(world(w), world(w, [...w.models, recruit]));
	return broken ? no(broken) : ok;
}

/** Everything that makes the list illegal right now (empty when it is valid). */
export function warbandIssues(w: WarbandState, rules: VariantRules, entries: EntryRef[]): string[] {
	if (w.unrestricted) return [];
	const out: string[] = [];
	const active = w.models.filter((m) => m.status === 'active');
	if (!active.length) return ['The warband has no models yet.'];
	const isLeader = (m: ModelState) => m.keywords.some((k) => letters(k) === 'leader') || (!!rules.leader && same(m.type, rules.leader));
	const leaders = active.filter(isLeader).length;
	// A Leader is the warband's if it has one ("if you have one available"); only a variant that names one requires it.
	if (leaders === 0 && rules.leader) out.push(`The warband must include its Leader (${rules.leader}).`);
	if (leaders > 1) out.push(`The warband has ${leaders} Leaders; it may have only one.`);
	for (const need of rules.mustInclude) {
		const n = active.filter((m) => same(m.type, need.name)).length;
		if (n < need.n) out.push(`The warband must include ${need.n} ${need.name}.`);
	}
	for (const x of rules.excluded)
		if (active.some((m) => same(m.type, x) || (m.category === 'mercenary' && letters(x) === 'mercenaries'))) out.push(`It cannot include ${x}.`);
	const elites = active.filter((m) => m.category === 'elite').length;
	if (elites > 6) out.push(`${elites} ELITE models; the most is 6.`);
	for (const e of entries) {
		const cap = rules.caps.find((c) => same(c.name, e.name))?.max ?? e.availabilityMax;
		const n = active.filter((m) => same(m.type, e.name)).length;
		if (cap != null && n > cap) out.push(`${n} ${e.name}: the limit is ${cap}.`);
	}
	const counts = new Map<string, number>();
	for (const i of [...active.flatMap((m) => m.equipment), ...w.stash]) counts.set(letters(i.name), (counts.get(letters(i.name)) ?? 0) + 1);
	for (const a of w.armoury) {
		const n = itemFacts(a).limitExcludes ? limitCount(a, w) : (counts.get(letters(a.name)) ?? 0);
		if (a.limit != null && n > a.limit) out.push(`${n} × ${a.name}: the limit is ${a.limit}.`);
	}
	// Each model's kit, put on again one piece at a time against the Battlekit Limits and its entry's rules
	// (an imported or older list never went through the builder's checks).
	for (const m of active) {
		// Its fixed kit (with an armour swap taken, the kit swapped in) passes once each; a second copy is checked.
		const swapped = m.kit.swap && m.upgrades.includes(m.kit.swap.to) ? m.kit.swap : null;
		const fixed = m.kit.fixed.map((n) => letters(swapped && letters(n) === letters(swapped.from) ? swapped.to : n));
		let acc: ModelState = { ...m, equipment: [] };
		for (const e of m.equipment) {
			const a = findItem(w.armoury, e.name);
			const k = fixed.indexOf(letters(e.name));
			if (k >= 0) fixed.splice(k, 1);
			else if (a) {
				const c = equipCheck(acc, a, { ...w, models: [acc], stash: [], ducats: Infinity, glory: Infinity, limits: [], openExploration: true });
				if (!c.ok) out.push(`${m.type} with ${e.name}: ${c.reason}.`);
			}
			acc = { ...acc, equipment: [...acc.equipment, e] };
		}
		const loadout = m.kit.loadouts?.length ? loadoutCheck(m.equipment.map((e) => e.name), m.kit.loadouts, true) : null;
		if (loadout) out.push(`${m.type}: ${loadout}`);
	}
	out.push(...limitIssues(world(w)).map((i) => i.text));
	for (const u of rules.upgrades) {
		const on = active.filter((m) => m.upgrades.includes(u.name));
		if (u.max != null && on.length > u.max) out.push(`${u.name} on ${on.length} models; the most is ${u.max}.`);
		for (const m of on) if (u.for.length && !u.for.some((x) => qualifies(m, x))) out.push(`${u.name} is only for ${u.for.join(', ')} (${m.type} has it).`);
	}
	if (rules.requiresVariant && w.variant === null) out.push('The warband must be one of its faction\'s variants.');
	if (rules.patron && !(w.patron && letters(w.patron).startsWith(letters(rules.patron)))) out.push(`The warband must serve ${rules.patron} as its Patron.`);
	if (w.ducats < 0) out.push(`The strongbox is ${-w.ducats} Ducats short.`);
	if (w.glory < 0) out.push(`The strongbox is ${-w.glory} Glory short.`);
	return out;
}
