/**
 * The warband-building rules of the books, as pure functions the builder (and its tests) can run:
 * what a warband starts with, what a model may be given, who may be recruited, and what makes a list illegal.
 *
 * Sources: Warbands of Trench Crusade, "Starting a Warband" (700 Ducats, at most 6 ELITE, stipulations) and
 * each Faction List's special rules; Trench Crusade Rulebook, "Battlekit Limits" (hands, one armour, …).
 * The facts are read from the imported rules text, so a correction in Admin → Rules corrects the builder.
 */
import type { Currency } from './roster';

export type ArmouryCategory = 'ranged' | 'grenade' | 'melee' | 'armour' | 'shield' | 'equipment' | 'special';

export const letters = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
const singular = (s: string) => s.replace(/s$/, '');
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
	hands?: 0 | 1 | 2;
	dual?: boolean;
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
	for (const o of overrides) if (o) Object.assign(r, definedOnly(o));
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
}

export type Check = { ok: true } | { ok: false; reason: string };
const ok: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

export const findItem = (armoury: ArmouryItem[], name: string) => armoury.find((a) => letters(a.name) === letters(name)) ?? null;

/** Does a model count as "X" for an "X only" stipulation: its entry, a keyword, or (for "Rifle") its weapon? */
function qualifies(m: ModelState, x: string) {
	const k = letters(x);
	if (k === 'elite') return m.category === 'elite' || m.keywords.some((w) => letters(w) === 'elite');
	if (m.keywords.some((w) => letters(w) === k)) return true;
	const t = letters(m.type);
	if (t === k || singular(t) === singular(k) || t.includes(singular(k)) || singular(k).includes(singular(t))) return true;
	// "Rifle only" (a sniper scope): the model carries a rifle.
	return m.equipment.some((e) => letters(e.name).includes(k));
}

/** Hands used by a model's weapons, per the Rulebook's Battlekit Limits. */
function handsUsed(m: ModelState, armoury: ArmouryItem[], extra?: ArmouryItem) {
	const items = [...m.equipment.map((e) => findItem(armoury, e.name)).filter((x): x is ArmouryItem => !!x), ...(extra ? [extra] : [])];
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

/** May this model be given this item? The first rule it breaks is the reason. */
export function equipCheck(m: ModelState, item: ArmouryItem, w: WarbandState): Check {
	const f = itemFacts(item);
	if (!w.unrestricted) {
		if (m.kit.nothingElse) return no(`A ${m.type} cannot have any other Battlekit`);
		if (m.kit.except.includes(item.category)) return no(`A ${m.type} cannot take ${item.category === 'armour' ? 'Armour' : item.category + ' kit'}`);
		if (f.explorationOnly && !w.openExploration) return no('Found through Exploration only');
		if (f.only.length && !f.only.some((x) => qualifies(m, x))) return no(`${f.only.join(' or ')} only`);
		if (item.limit != null) {
			const held = [...w.models.flatMap((x) => x.equipment), ...w.stash].filter((e) => letters(e.name) === letters(item.name)).length;
			if (held >= item.limit) return no(`Limit ${held}/${item.limit} used`);
		}
		if (f.perModel != null && m.equipment.filter((e) => letters(e.name) === letters(item.name)).length >= f.perModel)
			return no(`${f.perModel} per model`);
		const cur = handsUsed(m, w.armoury);
		const next = handsUsed(m, w.armoury, item);
		const shield = next.shield;
		if (item.category === 'ranged' && next.ranged > 2) return no(`No free hands for a ranged weapon (${cur.ranged} of 2 in use)`);
		if (item.category === 'melee' && next.melee > 2) return no(`No free hands for a melee weapon (${cur.melee} of 2 in use)`);
		if (shield) {
			const combo = itemFacts(shield).shieldCombo;
			const bad = next.twoHanded.find((t) => !(combo && itemFacts(t).shieldCombo));
			if (bad) return no(`${bad.name} is 2-Handed and needs Shield Combo with ${shield.name}`);
			if (next.ranged > 1 && !next.rangedTwo) return no(`With a Shield, only one 1-Handed ranged weapon`);
			if (next.melee > 1 && !next.meleeTwo) return no(`With a Shield, only one 1-Handed melee weapon`);
		}
		const has = (cat: ArmouryCategory) => cur.items.some((i) => i.category === cat);
		if (item.category === 'grenade' && has('grenade')) return no('Only one type of Grenade');
		if (item.category === 'armour' && has('armour')) return no('Only one suit of Armour');
		if (item.category === 'shield' && has('shield')) return no('Only one Shield');
		if (f.headgear && cur.items.some((i) => itemFacts(i).headgear)) return no('Only one piece of Headgear');
		if ((item.category === 'equipment' || item.category === 'special') && m.equipment.some((e) => letters(e.name) === letters(item.name)))
			return no(`Already has ${item.name}`);
		if (letters(item.name) === 'bayonet' && !cur.items.some((i) => i.category === 'ranged' && itemFacts(i).bayonetLug))
			return no('Needs a ranged weapon with a Bayonet Lug');
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
}

const same = (a: string, b: string) => {
	const x = singular(letters(a));
	const y = singular(letters(b));
	return x === y || x.includes(y) || y.includes(x);
};

/** May the warband recruit this entry now? */
export function recruitCheck(
	e: EntryRef,
	w: WarbandState,
	rules: VariantRules,
	faction: { name: string; alignment: 'faithful' | 'fallen'; variant: string | null }
): Check {
	if (w.unrestricted) return ok;
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
	const purse = e.currency === 'glory' ? w.glory : w.ducats;
	if (e.cost > purse) return no(`Costs ${e.cost} ${e.currency === 'glory' ? 'Glory' : 'Ducats'}; ${purse} in the strongbox`);
	return ok;
}

/** Everything that makes the list illegal right now (empty when it is valid). */
export function warbandIssues(w: WarbandState, rules: VariantRules, entries: EntryRef[]): string[] {
	if (w.unrestricted) return [];
	const out: string[] = [];
	const active = w.models.filter((m) => m.status === 'active');
	if (!active.length) return ['The warband has no models yet.'];
	const isLeader = (m: ModelState) => m.keywords.some((k) => letters(k) === 'leader') || (!!rules.leader && same(m.type, rules.leader));
	const leaders = active.filter(isLeader).length;
	if (leaders === 0) out.push(rules.leader ? `The warband must include its Leader (${rules.leader}).` : 'The warband has no Leader.');
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
	for (const a of w.armoury) if (a.limit != null && (counts.get(letters(a.name)) ?? 0) > a.limit) out.push(`${counts.get(letters(a.name))} × ${a.name}: the limit is ${a.limit}.`);
	for (const u of rules.upgrades) {
		const n = active.filter((m) => m.upgrades.includes(u.name)).length;
		if (u.max != null && n > u.max) out.push(`${u.name} on ${n} models; the most is ${u.max}.`);
	}
	if (w.ducats < 0) out.push(`The strongbox is ${-w.ducats} Ducats short.`);
	if (w.glory < 0) out.push(`The strongbox is ${-w.glory} Glory short.`);
	return out;
}
