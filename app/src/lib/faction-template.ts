/**
 * The Faction Studio's file format: one YAML document describes a faction (or a variant of one) with its
 * rules, units, armoury and new keywords. The same format is exported from the Studio, so a faction can be
 * written by hand, downloaded, edited and uploaded again.
 */
import { parse, stringify } from 'yaml';
import type { RulesOverride, StipulationsOverride, UnitKitOverride, Upgrade } from './warband-rules';

export const ALIGNMENTS = ['faithful', 'fallen'] as const;
export const UNIT_CATEGORIES = ['elite', 'troop', 'mercenary'] as const;
export const ITEM_CATEGORIES = ['ranged', 'melee', 'grenade', 'armour', 'shield', 'equipment', 'special'] as const;
export const ITEM_TYPES = ['1-Handed', '2-Handed', 'Grenade', 'Armour', 'Shield', 'Equipment', 'Special'] as const;
export const CURRENCIES = ['ducats', 'glory'] as const;
export const KIT_EXCEPT = ['ranged', 'melee', 'grenade', 'armour', 'shield', 'equipment'] as const;

// ---------------------------------------------------------------- rows (what the database stores)

export interface FactionRow {
	id: string;
	name: string;
	alignment: 'faithful' | 'fallen';
	parent: string | null;
	description: string | null;
	colours: { metal: string; low: string; high: string } | null;
}
export interface UnitRow {
	id: string;
	faction: string;
	variant: string | null;
	name: string;
	category: 'elite' | 'troop' | 'mercenary';
	availabilityMin: number;
	availabilityMax: number | null;
	cost: number;
	currency: 'ducats' | 'glory';
	stats: { movement?: string; ranged?: string; melee?: string; armour?: string; base?: string };
	keywords: string[];
	abilities: { name: string; text: string }[];
	battlekitNote: string | null;
	powers: string | null;
	description: string | null;
	kit: UnitKitOverride | null;
}
export interface ItemRow {
	id: string;
	faction: string;
	variant: string | null;
	category: (typeof ITEM_CATEGORIES)[number];
	name: string;
	unique: boolean;
	cost: number;
	currency: 'ducats' | 'glory';
	limit: number | null;
	restrictions: string | null;
	type: string | null;
	range: string | null;
	keywords: string[];
	text: string | null;
	description: string | null;
	stipulations: StipulationsOverride | null;
}
export interface KeywordRow {
	name: string;
	kind: string | null;
	text: string;
}
export interface RulesRow {
	id: string;
	faction: string;
	variant: string | null;
	text: string;
	overrides: RulesOverride | null;
}
export interface FactionPack {
	faction: FactionRow;
	/** The faction id the rows are filed under, and the variant (for a variant file). */
	factionId: string;
	variant: string | null;
	rules: RulesRow;
	units: UnitRow[];
	items: ItemRow[];
	keywords: KeywordRow[];
}

// ---------------------------------------------------------------- ids, the same as the book importer's

export const slug = (s: string) =>
	s
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
export const unitId = (faction: string, variant: string | null, name: string) => slug(`${faction}-${variant ?? ''}-${name}`);
export const itemId = (faction: string, variant: string | null, name: string) =>
	`${faction}:${variant ?? ''}:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** The restrictions text the compendium shows (the builder reads `stipulations` first). */
export function restrictionsText(s: StipulationsOverride | null, limit: number | null) {
	if (!s) return null;
	const parts = [
		s.only?.length ? `${s.only.join(', ')} only` : '',
		s.bayonetLug ? 'Bayonet Lug' : '',
		s.shieldCombo ? 'Shield Combo' : '',
		s.consumable ? 'Consumable' : '',
		s.headgear ? 'Headgear' : '',
		s.explorationOnly ? 'Exploration only' : '',
		limit != null ? `Limit: ${limit}${s.perModel ? ` (${s.perModel} per model)` : ''}` : s.perModel ? `${s.perModel} per model` : ''
	].filter(Boolean);
	return parts.length ? parts.join(', ') : null;
}

// ---------------------------------------------------------------- parse

export interface TemplateError {
	path: string;
	message: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Read a template into rows, or say exactly what is wrong (by path) and read nothing. */
export function parseTemplate(text: string, known: Known = { factions: [] }): { pack: FactionPack | null; errors: TemplateError[] } {
	let doc: unknown;
	try {
		doc = parse(text);
	} catch (e) {
		return { pack: null, errors: [{ path: '(file)', message: (e as Error).message.split('\n')[0] }] };
	}
	return readTemplate(doc, known);
}

type Known = { factions: { id: string; name: string }[] };

/** The same as parseTemplate, from an already-read document (the Studio's forms build one). */
export function readTemplate(doc: unknown, known: Known = { factions: [] }): { pack: FactionPack | null; errors: TemplateError[] } {
	const errors: TemplateError[] = [];
	const err = (path: string, message: string) => errors.push({ path, message });
	if (!isObj(doc)) return { pack: null, errors: [{ path: '(file)', message: 'Expected a document with faction:, rules:, units: and armoury:' }] };

	const str = (v: unknown, path: string, req = false, max = 20_000): string | null => {
		if (v == null || v === '') {
			if (req) err(path, 'is required');
			return null;
		}
		if (typeof v !== 'string' && typeof v !== 'number') {
			err(path, 'must be text');
			return null;
		}
		return String(v).trim().slice(0, max) || null;
	};
	const num = (v: unknown, path: string, d: number | null = null): number | null => {
		if (v == null || v === '') return d;
		const n = Number(v);
		if (!Number.isFinite(n) || n < 0) {
			err(path, 'must be a number of 0 or more');
			return d;
		}
		return Math.round(n);
	};
	const oneOf = <T extends string>(v: unknown, opts: readonly T[], path: string, d: T): T => {
		if (v == null || v === '') return d;
		const s = String(v).toLowerCase();
		const hit = opts.find((o) => o.toLowerCase() === s);
		if (!hit) err(path, `must be one of: ${opts.join(', ')}`);
		return hit ?? d;
	};
	const list = (v: unknown, path: string): string[] => {
		if (v == null) return [];
		if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
		if (!Array.isArray(v)) {
			err(path, 'must be a list');
			return [];
		}
		return v.map((x) => String(x).trim()).filter(Boolean);
	};
	const bool = (v: unknown) => v === true || v === 'yes' || v === 'true';

	// Faction
	const f = isObj(doc.faction) ? doc.faction : (err('faction', 'is required'), {} as Obj);
	const name = str(f.name, 'faction.name', true) ?? '';
	const parent = str(f.parent, 'faction.parent');
	const parentFaction = parent ? known.factions.find((x) => x.id === parent || slug(x.name) === slug(parent)) : null;
	if (parent && known.factions.length && !parentFaction) err('faction.parent', `no faction called "${parent}"`);
	const id = parent ? `${parentFaction?.id ?? slug(parent)}--${slug(name)}` : slug(str(f.id, 'faction.id') ?? name);
	const colours = isObj(f.colours)
		? { metal: str(f.colours.metal, 'faction.colours.metal') ?? '#b8b0a0', low: str(f.colours.low, 'faction.colours.low') ?? '#8f8570', high: str(f.colours.high, 'faction.colours.high') ?? '#ece5d3' }
		: null;
	for (const [k, v] of Object.entries(colours ?? {})) if (!/^#[0-9a-f]{6}$/i.test(v)) err(`faction.colours.${k}`, 'must be a colour like #b3160c');
	const faction: FactionRow = {
		id,
		name,
		alignment: oneOf(f.alignment, ALIGNMENTS, 'faction.alignment', 'faithful'),
		parent: parentFaction?.id ?? (parent ? slug(parent) : null),
		description: str(f.description, 'faction.description'),
		colours
	};
	const factionId = faction.parent ?? faction.id;
	const variant = faction.parent ? faction.name : null;

	// Rules
	const r = isObj(doc.rules) ? doc.rules : {};
	const pairs = (v: unknown, path: string, key: string) =>
		(Array.isArray(v) ? v : []).map((x, i) => {
			if (typeof x === 'string') return { name: x, [key]: 1 };
			if (isObj(x)) return { name: str(x.name, `${path}[${i}].name`, true) ?? '', [key]: num(x[key], `${path}[${i}].${key}`, 1) ?? 1 };
			err(`${path}[${i}]`, 'must be a name or { name, ' + key + ' }');
			return { name: '', [key]: 0 };
		});
	const upgrades: Upgrade[] = (Array.isArray(r.upgrades) ? r.upgrades : []).map((u: unknown, i: number) => {
		const o = isObj(u) ? u : (err(`rules.upgrades[${i}]`, 'must be { name, keyword, max, cost }'), {} as Obj);
		return {
			name: str(o.name, `rules.upgrades[${i}].name`, true) ?? '',
			keyword: str(o.keyword, `rules.upgrades[${i}].keyword`)?.toUpperCase() ?? null,
			max: num(o.max, `rules.upgrades[${i}].max`),
			cost: num(o.cost, `rules.upgrades[${i}].cost`, 0) ?? 0,
			currency: oneOf(o.currency, CURRENCIES, `rules.upgrades[${i}].currency`, 'ducats'),
			for: list(o.for, `rules.upgrades[${i}].for`),
			text: str(o.text, `rules.upgrades[${i}].text`) ?? ''
		};
	});
	const overrides: RulesOverride = {
		...(r.start_ducats != null ? { startDucats: num(r.start_ducats, 'rules.start_ducats', 700) ?? 700 } : {}),
		...(r.start_glory != null ? { startGlory: num(r.start_glory, 'rules.start_glory', 0) ?? 0 } : {}),
		alignment: faction.alignment,
		...(r.excluded != null ? { excluded: list(r.excluded, 'rules.excluded') } : {}),
		...(r.must_include != null ? { mustInclude: pairs(r.must_include, 'rules.must_include', 'n') as { name: string; n: number }[] } : {}),
		...(r.leader != null ? { leader: str(r.leader, 'rules.leader') } : {}),
		...(r.optional != null ? { optional: list(r.optional, 'rules.optional') } : {}),
		...(r.caps != null ? { caps: pairs(r.caps, 'rules.caps', 'max') as { name: string; max: number }[] } : {}),
		...(r.free_items != null ? { freeItems: list(r.free_items, 'rules.free_items') } : {}),
		...(r.fireteams != null ? { fireteams: num(r.fireteams, 'rules.fireteams', 0) ?? 0 } : {}),
		...(r.upgrades != null ? { upgrades } : {})
	};
	const rules: RulesRow = {
		id: `${factionId}:${variant ?? ''}`,
		faction: factionId,
		variant,
		text: str(r.text, 'rules.text') ?? '',
		overrides
	};

	// Keywords
	const keywords: KeywordRow[] = (Array.isArray(doc.keywords) ? doc.keywords : []).map((k: unknown, i: number) => {
		const o = isObj(k) ? k : (err(`keywords[${i}]`, 'must be { name, kind, text }'), {} as Obj);
		return {
			name: (str(o.name, `keywords[${i}].name`, true) ?? '').toUpperCase(),
			kind: o.kind ? oneOf(o.kind, ['Tag', 'Effect', 'Tag, Effect'] as const, `keywords[${i}].kind`, 'Effect') : null,
			text: str(o.text, `keywords[${i}].text`, true) ?? ''
		};
	});

	// Units
	const units: UnitRow[] = (Array.isArray(doc.units) ? doc.units : []).map((u: unknown, i: number) => {
		const p = `units[${i}]`;
		const o = isObj(u) ? u : (err(p, 'must be a unit'), {} as Obj);
		const uname = str(o.name, `${p}.name`, true) ?? '';
		const category = oneOf(o.category, UNIT_CATEGORIES, `${p}.category`, 'troop');
		const uvariant = variant ?? str(o.variant, `${p}.variant`);
		const faction = factionId;
		// Availability: "0-2", "1", "any", or { min, max }.
		let min = 0;
		let max: number | null = null;
		const av = o.availability;
		if (isObj(av)) {
			min = num(av.min, `${p}.availability.min`, 0) ?? 0;
			max = num(av.max, `${p}.availability.max`);
		} else if (av != null && String(av).toLowerCase() !== 'any') {
			const m = String(av).match(/^(\d+)(?:\s*-\s*(\d+))?$/);
			if (!m) err(`${p}.availability`, 'must be like "0-2", "1" or "any"');
			else [min, max] = m[2] ? [Number(m[1]), Number(m[2])] : [0, Number(m[1])];
		}
		const s = isObj(o.stats) ? o.stats : {};
		const kitIn = isObj(o.kit) ? o.kit : null;
		const hire = isObj(o.hired_by) ? o.hired_by : null;
		const swap = kitIn && isObj(kitIn.swap) ? kitIn.swap : null;
		const kit: UnitKitOverride | null =
			kitIn || hire
				? {
						...(kitIn?.fixed != null ? { fixed: list(kitIn.fixed, `${p}.kit.fixed`) } : {}),
						...(kitIn?.except != null ? { except: list(kitIn.except, `${p}.kit.except`).map((c, k) => oneOf(c, KIT_EXCEPT, `${p}.kit.except[${k}]`, 'armour')) } : {}),
						...(kitIn?.nothing_else != null ? { nothingElse: bool(kitIn.nothing_else) } : {}),
						...(swap
							? { swap: { from: str(swap.from, `${p}.kit.swap.from`, true) ?? '', to: str(swap.to, `${p}.kit.swap.to`, true) ?? '', extra: num(swap.extra, `${p}.kit.swap.extra`, 0) ?? 0 } }
							: {}),
						...(hire ? { hire: { alignment: hire.alignment ? oneOf(hire.alignment, ALIGNMENTS, `${p}.hired_by.alignment`, 'faithful') : null, by: list(hire.by, `${p}.hired_by.by`) } } : {})
					}
				: null;
		return {
			id: unitId(faction, uvariant, uname),
			faction,
			variant: uvariant,
			name: uname,
			category,
			availabilityMin: min,
			availabilityMax: max,
			cost: num(o.cost, `${p}.cost`, 0) ?? 0,
			currency: oneOf(o.currency, CURRENCIES, `${p}.currency`, category === 'mercenary' ? 'glory' : 'ducats'),
			stats: Object.fromEntries(['movement', 'ranged', 'melee', 'armour', 'base'].map((k) => [k, str(s[k], `${p}.stats.${k}`, false, 30)]).filter(([, v]) => v)),
			keywords: list(o.keywords, `${p}.keywords`).map((k) => k.toUpperCase()),
			abilities: (Array.isArray(o.abilities) ? o.abilities : []).map((a: unknown, k: number) => {
				const ao = isObj(a) ? a : {};
				return { name: str(ao.name, `${p}.abilities[${k}].name`, true) ?? '', text: str(ao.text, `${p}.abilities[${k}].text`) ?? '' };
			}),
			battlekitNote: str(o.battlekit_note, `${p}.battlekit_note`),
			powers: str(o.powers, `${p}.powers`),
			description: str(o.description, `${p}.description`),
			kit
		};
	});

	// Armoury
	const items: ItemRow[] = (Array.isArray(doc.armoury) ? doc.armoury : []).map((it: unknown, i: number) => {
		const p = `armoury[${i}]`;
		const o = isObj(it) ? it : (err(p, 'must be an item'), {} as Obj);
		const iname = str(o.name, `${p}.name`, true) ?? '';
		const ivariant = variant ?? str(o.variant, `${p}.variant`);
		const limit = num(o.limit, `${p}.limit`);
		const st = isObj(o.stipulations) ? o.stipulations : null;
		const type = o.type != null ? oneOf(o.type, ITEM_TYPES, `${p}.type`, 'Equipment') : null;
		const stipulations: StipulationsOverride | null = st
			? {
					...(st.only != null ? { only: list(st.only, `${p}.stipulations.only`) } : {}),
					...(st.per_model != null ? { perModel: num(st.per_model, `${p}.stipulations.per_model`) } : {}),
					...(st.shield_combo != null ? { shieldCombo: bool(st.shield_combo) } : {}),
					...(st.bayonet_lug != null ? { bayonetLug: bool(st.bayonet_lug) } : {}),
					...(st.consumable != null ? { consumable: bool(st.consumable) } : {}),
					...(st.headgear != null ? { headgear: bool(st.headgear) } : {}),
					...(st.exploration_only != null ? { explorationOnly: bool(st.exploration_only) } : {})
				}
			: null;
		return {
			id: itemId(factionId, ivariant, iname),
			faction: factionId,
			variant: ivariant,
			category: oneOf(o.category, ITEM_CATEGORIES, `${p}.category`, 'equipment'),
			name: iname,
			unique: bool(o.unique),
			cost: num(o.cost, `${p}.cost`, 0) ?? 0,
			currency: oneOf(o.currency, CURRENCIES, `${p}.currency`, 'ducats'),
			limit,
			restrictions: str(o.restrictions, `${p}.restrictions`) ?? restrictionsText(stipulations, limit),
			type,
			range: str(o.range, `${p}.range`, false, 40),
			keywords: list(o.keywords, `${p}.keywords`).map((k) => k.toUpperCase()),
			text: str(o.text, `${p}.text`),
			description: str(o.description, `${p}.description`),
			stipulations
		};
	});

	const pack: FactionPack = { faction, factionId, variant, rules, units, items, keywords };
	return errors.length ? { pack: null, errors } : { pack, errors };
}

// ---------------------------------------------------------------- export

/** Leave out empty keys; `keepLists` keeps [] (in rules an empty list clears what the book text says). */
const drop = <T extends Obj>(o: T, keepLists = false): T =>
	Object.fromEntries(
		Object.entries(o).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length && !keepLists) && !(isObj(v) && !Object.keys(v).length))
	) as T;

/** A faction (or variant) as a template document. */
export function toTemplate(p: Omit<FactionPack, 'factionId'> & { factionId?: string }): string {
	const o = p.rules.overrides ?? {};
	const doc = drop({
		faction: drop({
			id: p.faction.parent ? undefined : p.faction.id,
			name: p.faction.name,
			alignment: p.faction.alignment,
			parent: p.faction.parent ?? undefined,
			description: p.faction.description ?? undefined,
			colours: p.faction.colours ?? undefined
		}),
		rules: drop({
			start_ducats: o.startDucats,
			start_glory: o.startGlory,
			excluded: o.excluded,
			must_include: o.mustInclude,
			leader: o.leader ?? undefined,
			optional: o.optional,
			caps: o.caps,
			free_items: o.freeItems,
			fireteams: o.fireteams,
			upgrades: o.upgrades?.map((u) => drop({ name: u.name, keyword: u.keyword ?? undefined, max: u.max ?? undefined, cost: u.cost || undefined, currency: u.currency === 'glory' ? 'glory' : undefined, for: u.for, text: u.text })),
			text: p.rules.text || undefined
		}, true),
		keywords: p.keywords.map((k) => drop({ name: k.name, kind: k.kind ?? undefined, text: k.text })),
		units: p.units.map((u) =>
			drop({
				name: u.name,
				category: u.category,
				cost: u.cost,
				currency: u.currency,
				availability: u.availabilityMax == null ? 'any' : u.availabilityMin ? `${u.availabilityMin}-${u.availabilityMax}` : `0-${u.availabilityMax}`,
				variant: p.faction.parent ? undefined : (u.variant ?? undefined),
				stats: drop(u.stats as Obj),
				keywords: u.keywords,
				abilities: u.abilities,
				battlekit_note: u.battlekitNote ?? undefined,
				powers: u.powers ?? undefined,
				description: u.description ?? undefined,
				kit: u.kit
					? drop({ fixed: u.kit.fixed, except: u.kit.except, nothing_else: u.kit.nothingElse, swap: u.kit.swap ?? undefined })
					: undefined,
				hired_by: u.kit?.hire ? drop({ alignment: u.kit.hire.alignment ?? undefined, by: u.kit.hire.by }) : undefined
			})
		),
		armoury: p.items.map((i) =>
			drop({
				name: i.name,
				category: i.category,
				cost: i.cost,
				currency: i.currency,
				limit: i.limit ?? undefined,
				variant: p.faction.parent ? undefined : (i.variant ?? undefined),
				type: i.type ?? undefined,
				range: i.range ?? undefined,
				keywords: i.keywords,
				unique: i.unique || undefined,
				stipulations: i.stipulations
					? drop({
							only: i.stipulations.only,
							per_model: i.stipulations.perModel ?? undefined,
							shield_combo: i.stipulations.shieldCombo || undefined,
							bayonet_lug: i.stipulations.bayonetLug || undefined,
							consumable: i.stipulations.consumable || undefined,
							headgear: i.stipulations.headgear || undefined,
							exploration_only: i.stipulations.explorationOnly || undefined
						})
					: undefined,
				restrictions: i.stipulations ? undefined : (i.restrictions ?? undefined),
				text: i.text ?? undefined,
				description: i.description ?? undefined
			})
		)
	});
	return stringify(doc, { lineWidth: 110 });
}

// ---------------------------------------------------------------- the documented template

/** The template file: every key with its allowed values, the known keywords, and a worked example. */
export function templateText(glossary: { name: string; kind: string | null }[]): string {
	const tags = glossary.filter((k) => /tag/i.test(k.kind ?? '')).map((k) => k.name);
	const effects = glossary.filter((k) => !/tag/i.test(k.kind ?? '')).map((k) => k.name);
	const wrap = (xs: string[]) =>
		xs
			.join(', ')
			.replace(/(.{1,96})(, |$)/g, '#   $1$2\n')
			.trimEnd();
	return `# Carcass Front — Faction Studio template
#
# One file describes one faction, or one variant of a faction (set faction.parent).
# Fill it in, then upload it in Admin → Faction Studio → Import. Everything here can also be
# edited in the Studio and downloaded again in this same format.
#
# Values in <angle brackets> are to replace. Leave out any key you do not need.
#
# ── Allowed values ─────────────────────────────────────────────────────────────────────────────
#   alignment ............ ${ALIGNMENTS.join(' | ')}
#   unit category ........ ${UNIT_CATEGORIES.join(' | ')}
#   item category ........ ${ITEM_CATEGORIES.join(' | ')}
#   item type ............ ${ITEM_TYPES.join(' | ')}     (1-/2-Handed = the hands it takes)
#   currency ............. ${CURRENCIES.join(' | ')}
#   kit.except ........... ${KIT_EXCEPT.join(' | ')}
#   availability ......... "0-2" (at most 2), "1" (at most 1), "1-1" (exactly 1), "any"
#   range ................ '24"'  'Melee'  '12"/Melee' (dual-purpose: counts once)
#
#   (an item's warband-wide Limit is its own key, limit: 2, beside cost)
#
# ── Stipulations on armoury items (Warbands of Trench Crusade, "Armoury Stipulations") ────────
#   only: [ELITE, "Unit Name", KEYWORD]   "X only": entry names or keywords that may take it
#   per_model: 1                          at most 1 on any one model
#   shield_combo: true                    may be carried with a shield that also has Shield Combo
#   bayonet_lug: true                     a Bayonet may be bought for a model carrying this
#   consumable: true                      removed from the roster once used in a game
#   headgear: true                        a model may have only one piece of headgear
#   exploration_only: true                only found through Exploration (or "Open Exploration")
#
# ── Battlekit limits the builder always applies (Rulebook, "Battlekit Limits") ────────────────
#   one 2-Handed or two 1-Handed ranged weapons; the same for melee; one grenade type; one armour;
#   one shield (it takes a hand: then one 1-Handed weapon of each kind, 2-Handed only with Shield
#   Combo on both); STRONG carries a 2-Handed melee weapon in one hand unless it is CUMBERSOME;
#   no two pieces of equipment with the same name; at most 6 ELITE models.
#
# ── Keywords you can use (from your rules glossary) ──────────────────────────────────────────
#   Tags:
${wrap(tags)}
#   Effects:
${wrap(effects)}
#   New keywords: define them under keywords: below and they join the glossary.

faction:
  id: <carnival-of-saints>          # a short id; leave out for a variant
  name: <Carnival of Saints>
  alignment: faithful
  # parent: <new-antioch>           # set this to make a VARIANT of an existing faction
  description: >-
    <A few lines of lore, shown on the faction's compendium page.>
  colours:                          # the seal's metal and the light rising through it
    metal: "#c9a24a"
    low: "#8f1f18"
    high: "#f4d6a0"

rules:
  start_ducats: 700                 # what a new warband has to spend
  start_glory: 0
  excluded: []                      # entries this warband cannot include ("Mercenaries" = none at all)
  must_include:                     # entries it must include
    - { name: <Grand Master>, n: 1 }
  leader: <Grand Master>            # the entry that has the LEADER keyword in this warband
  optional: []                      # entries whose usual "must include" is lifted
  caps:                             # lower limits on entries ("can only include 0-2 …")
    - { name: <Pilgrim Hound>, max: 2 }
  free_items: [<Relic of the Saint>] # given free the first time (to one model)
  fireteams: 0                      # how many Fireteams (pairs) the warband may form
  upgrades:                         # keyword upgrades a number of models may take
    - name: <Holy Oath>
      keyword: NEGATE FEAR
      max: 3
      cost: 0
      text: <Up to 3 models can have the NEGATE FEAR Keyword at no additional cost.>
  text: |-                          # the special rules as players should read them (shown in the builder)
    * <Rule Name>: <What it does.>

keywords:                           # new keywords (leave empty to use only the glossary's)
  - name: <MASKED>
    kind: Tag                       # Tag | Effect | Tag, Effect
    text: <What the keyword means.>

units:
  - name: <Grand Master>
    category: elite
    cost: 80
    currency: ducats
    availability: "1-1"
    stats: { movement: '6"/Infantry', ranged: +1 DICE, melee: +2 DICE, armour: "0", base: 32mm }
    keywords: [ELITE, LEADER, TOUGH]
    abilities:
      - { name: <Inspiring>, text: <Friendly models within 6" add +1 DICE to Risky Success Rolls.> }
    battlekit_note: <A Grand Master can have any Battlekit from the Carnival of Saints Armoury.>
    description: <Lore for the compendium.>
  - name: <Pilgrim Hound>
    category: troop
    cost: 25
    availability: "0-4"
    stats: { movement: '8"/Infantry', ranged: "-", melee: +1 DICE, armour: "0", base: 32mm }
    keywords: [FEAR]
    kit:                            # builder facts (they win over the battlekit note's wording)
      fixed: [<Fangs>]              # always has (free, permanent)
      nothing_else: true            # cannot have any other battlekit
  - name: <Masked Knight>
    category: troop
    cost: 85
    availability: "0-3"
    stats: { movement: '6"/Infantry', ranged: +0 DICE, melee: +1 DICE, armour: "-1", base: 40mm }
    keywords: [STRONG]
    kit:
      fixed: [Reinforced Armour]
      except: [armour]              # may not take other armour
      swap: { from: Reinforced Armour, to: Machine Armour, extra: 10 }   # an upgrade that swaps kit
  - name: <Wandering Hermit>
    category: mercenary
    cost: 3
    currency: glory
    availability: "0-1"
    hired_by: { alignment: faithful, by: [<Carnival of Saints>, New Antioch] }

armoury:
  - name: <Saint's Rifle>
    category: ranged
    type: 2-Handed
    range: '24"'
    cost: 15
    keywords: [<CRITICAL>]
    limit: 2                        # the whole warband may hold at most 2 (next to cost, not a stipulation)
    stipulations: { bayonet_lug: true, only: [ELITE] }
    text: <Special rules of the weapon.>
  - name: <Censer Flail>
    category: melee
    type: 1-Handed
    range: Melee
    cost: 8
    stipulations: { shield_combo: true }
  - name: <Blessed Water>
    category: grenade
    type: Grenade
    range: '8"'
    cost: 10
    stipulations: { consumable: true, per_model: 1 }
    limit: 3
  - name: <Saint's Veil>
    category: equipment
    type: Equipment
    cost: 5
    stipulations: { headgear: true }
  - name: <Relic of the Saint>
    category: equipment
    type: Equipment
    cost: 3
    currency: glory
    limit: 1
  - name: <Holy Engine>
    category: special
    type: Special
    cost: 12
    stipulations: { exploration_only: true, only: [<Grand Master>] }
`;
}
