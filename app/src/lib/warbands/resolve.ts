/**
 * The effective faction a warband is built from: its faction with the chosen variant laid over it (entries replaced,
 * added or excluded; same-named rule keys replaced), the armoury lines and upgrades it may buy, the Patrons it may
 * serve and the Mercenaries it may hire. An expansion set is first merged over its base (same id: the expansion's).
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (readRules, hiredBy) and
 * app/src/lib/patrons.ts (patronAllowed), rewritten to ids and the rules folder format.
 */
import type {
	ArmouryLine,
	Faction,
	Item,
	Keyword,
	Limit,
	Patron,
	PriceRule,
	RulesSet,
	Table,
	Unit,
	Upgrade,
	Variant
} from '../rules/pack.ts';
import { letters } from './types.ts';

export type SetWithBase = RulesSet & { base?: SetWithBase };

export interface Rules {
	startDucats: number;
	startGlory: number;
	fireteams?: number;
	leader?: string;
	mustInclude: string[];
	caps: { unit: string; max: number }[];
	excluded: string[];
	freeItems: string[];
	limits: Limit[];
	prices: PriceRule[];
	patron?: string;
}

/** Keyword ids the battlekit rules know by name (found by name in the set, else `kw:<name>`). */
export const CONCEPTS = {
	strong: 'STRONG',
	heavy: 'HEAVY',
	cumbersome: 'CUMBERSOME',
	held: 'HELD',
	elite: 'ELITE',
	leader: 'LEADER',
	fireteam: 'FIRETEAM',
	negate: 'NEGATE',
	shieldCombo: 'SHIELD COMBO',
	bayonetLug: 'BAYONET LUG',
	headgear: 'HEADGEAR',
	consumable: 'CONSUMABLE'
} as const;
export type Concept = keyof typeof CONCEPTS;

export interface Resolved {
	set: RulesSet;
	faction: Faction;
	variant?: Variant;
	/** The variant's name, else the faction's. */
	name: string;
	alignment: Faction['alignment'];
	rules: Rules;
	units: Unit[];
	mercenaries: Unit[];
	/** The faction's (and variant's) armoury lines, its Glory table's and the exploration tables'. */
	lines: ArmouryLine[];
	upgrades: Upgrade[];
	patrons: Patron[];
	kw: Record<Concept, string>;
	/** A variant's entry that replaces a base one stands in for it: replacing id → replaced id. */
	alias: Map<string, string>;
	idx: {
		items: Map<string, Item>;
		units: Map<string, Unit>;
		upgrades: Map<string, Upgrade>;
		lines: Map<string, ArmouryLine>;
		keywords: Map<string, Keyword>;
		tables: Map<string, Table>;
		patrons: Map<string, Patron>;
	};
}

type Listed = Exclude<keyof RulesSet, 'manifest'>;

/** An expansion over its base (recursively): every list joined, an expansion element replacing a same-id base one. */
export function mergeSets(set: SetWithBase): RulesSet {
	if (!set.base) return set;
	const base = mergeSets(set.base);
	const out = { ...set } as RulesSet & { base?: unknown };
	delete out.base;
	for (const k of Object.keys(base) as (keyof RulesSet)[]) {
		if (k === 'manifest') continue;
		const own = set[k as Listed] as { id?: string }[];
		const mine = new Set(own.map((x) => x.id).filter(Boolean));
		(out[k as Listed] as unknown[]) = [
			...(base[k as Listed] as { id?: string }[]).filter((x) => !x.id || !mine.has(x.id)),
			...own
		];
	}
	return out;
}

/**
 * A faction's entries with a variant laid over: its own, each replaced one swapped in place, the variant's own and
 * added ones after, excluded ones dropped.
 */
function overlay<T extends { id: string; owner: string }>(
	all: T[],
	faction: string,
	v?: Variant
): T[] {
	const byId = new Map(all.map((x) => [x.id, x]));
	const to = new Map((v?.replaces ?? []).map((r) => [r.from, r.to]));
	const targets = new Set(to.values());
	const out = all
		.filter((x) => x.owner === faction)
		.map((x) => (to.has(x.id) ? byId.get(to.get(x.id)!) : x))
		.filter((x): x is T => !!x);
	if (v) {
		for (const x of all) if (x.owner === v.id && !targets.has(x.id)) out.push(x);
		for (const id of v.adds ?? []) {
			const x = byId.get(id);
			if (x && !out.includes(x)) out.push(x);
		}
	}
	return out;
}

const byName = <T extends { name?: string }>(a: T[], b: T[]) => [
	...a.filter((x) => !x.name || !b.some((y) => y.name && letters(y.name) === letters(x.name!))),
	...b
];
const union = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];

/** The faction's rules with the variant's keys over them: limits replace by name, caps by unit, exclusions add up. */
function mergeRules(f: Faction, v?: Variant): Rules {
	const r: Rules = {
		startDucats: f.startDucats,
		startGlory: f.startGlory,
		fireteams: f.fireteams,
		leader: f.leader,
		mustInclude: f.mustInclude ?? [],
		caps: f.caps ?? [],
		excluded: f.excluded ?? [],
		freeItems: f.freeItems ?? [],
		limits: f.limits ?? [],
		prices: f.prices ?? [],
		patron: f.patron
	};
	const o = v?.rules ?? {};
	if (o.startDucats !== undefined) r.startDucats = o.startDucats;
	if (o.startGlory !== undefined) r.startGlory = o.startGlory;
	if (o.fireteams !== undefined) r.fireteams = o.fireteams;
	if (o.leader !== undefined) r.leader = o.leader;
	if (o.mustInclude) r.mustInclude = o.mustInclude;
	if (o.prices) r.prices = o.prices;
	if (o.patron !== undefined) r.patron = o.patron;
	if (o.limits) r.limits = byName(r.limits, o.limits);
	if (o.caps)
		r.caps = [...r.caps.filter((c) => !o.caps!.some((d) => d.unit === c.unit)), ...o.caps];
	r.excluded = union(union(r.excluded, o.excluded ?? []), v?.excludes ?? []);
	if (o.freeItems) r.freeItems = union(r.freeItems, o.freeItems);
	return r;
}

/** May a warband of this faction (and variant) serve this Patron? A listed variant narrows only its own faction. */
export function patronAllowed(
	p: Patron,
	f: Faction,
	v: Variant | undefined,
	set: RulesSet
): boolean {
	if (p.alignment && p.alignment !== f.alignment) return false;
	if (!p.factions?.length) return true;
	const mine = set.variants.filter((x) => x.faction === f.id).map((x) => x.id);
	const named = p.factions.filter((x) => mine.includes(x));
	if (named.length) return !!v && named.includes(v.id);
	return p.factions.includes(f.id);
}

/** Who may hire a Mercenary: the factions it names, else its alignment, else anyone; or the faction lists it. */
function hires(u: Unit, f: Faction, v?: Variant) {
	if (f.mercenaries?.includes(u.id)) return true;
	const h = u.hiredBy;
	if (h?.factions?.length) return h.factions.includes(f.id) || (!!v && h.factions.includes(v.id));
	return !h?.alignment || h.alignment === f.alignment;
}

export function resolveFaction(
	input: SetWithBase,
	factionId: string,
	variantId?: string
): Resolved {
	const set = mergeSets(input);
	const faction = set.factions.find((f) => f.id === factionId);
	if (!faction) throw new Error(`No faction ${factionId} in ${set.manifest.id}.`);
	const variant = variantId ? set.variants.find((v) => v.id === variantId) : undefined;
	if (variantId && (!variant || variant.faction !== faction.id))
		throw new Error(`No variant ${variantId} of ${factionId} in ${set.manifest.id}.`);
	const rules = mergeRules(faction, variant);
	const out = new Set(rules.excluded);
	const keep = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !out.has(x.id));

	const units = keep(overlay(set.units, faction.id, variant)).filter(
		(u) => u.category !== 'mercenary'
	);
	const mercenaries = out.has('faction:mercenaries')
		? []
		: keep(set.units.filter((u) => u.category === 'mercenary' && hires(u, faction, variant)));
	const exploration = new Set(set.tables.filter((t) => t.kind === 'exploration').map((t) => t.id));
	const all = keep([
		...overlay(set.armouryLines, faction.id, variant),
		...set.armouryLines.filter((l) => !!faction.gloryTable && l.owner === faction.gloryTable),
		// Exploration finds are any warband's; their lines say explorationOnly, so they wait for a discovery.
		...set.armouryLines.filter((l) => exploration.has(l.owner))
	]);
	// An item taken out (by its id or one of its lines) is gone from every source, finds and Glory included.
	const gone = new Set(
		set.armouryLines.filter((l) => out.has(l.id) || out.has(l.item)).map((l) => l.item)
	);
	const lines = all.filter((l) => !gone.has(l.item) || (!!variant && l.owner === variant.id));
	const owners = new Set([...units, ...mercenaries].map((u) => u.id));
	const listed = new Set([...units, ...mercenaries].flatMap((u) => u.upgrades ?? []));
	const upgrades = keep([
		...overlay(set.upgrades, faction.id, variant),
		...set.upgrades.filter((u) => owners.has(u.owner) || listed.has(u.id))
	]);
	const patrons = set.patrons.filter((p) =>
		rules.patron ? p.id === rules.patron : patronAllowed(p, faction, variant, set)
	);
	const map = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
	const kwByName = new Map(set.keywords.map((k) => [letters(k.name), k.id]));
	const kw = Object.fromEntries(
		Object.entries(CONCEPTS).map(([k, n]) => [
			k,
			kwByName.get(letters(n)) ?? `kw:${n.toLowerCase().replace(/ /g, '-')}`
		])
	) as Record<Concept, string>;
	return {
		set,
		faction,
		variant,
		name: variant?.name ?? faction.name,
		alignment: faction.alignment,
		rules,
		units,
		mercenaries,
		lines,
		upgrades: [...new Set(upgrades)],
		patrons,
		kw,
		alias: new Map((variant?.replaces ?? []).map((r) => [r.to, r.from])),
		idx: {
			items: map(set.items),
			units: map(set.units),
			upgrades: map(set.upgrades),
			lines: map(set.armouryLines),
			keywords: map(set.keywords),
			tables: map(set.tables),
			patrons: map(set.patrons)
		}
	};
}

/** Is this element the one an id names: itself, the base entry it replaces, or the unit it counts as. */
export const isEl = (f: Resolved, id: string, el: { id: string; kit?: { countsAs?: string } }) =>
	el.id === id || f.alias.get(el.id) === id || el.kit?.countsAs === id;

/** One key per kind of entry, so a replacing or counts-as entry is counted with its base one. */
export const unitKey = (f: Resolved, u: { id: string; kit: { countsAs?: string } }) =>
	u.kit.countsAs ?? f.alias.get(u.id) ?? u.id;

/** Was this item taken out of the warband's armoury (by its id or by its lines')? */
export const excludedItem = (f: Resolved, itemId: string) =>
	f.rules.excluded.includes(itemId) ||
	f.set.armouryLines.some((l) => l.item === itemId && f.rules.excluded.includes(l.id));

/** A name for any id, for messages: the element's name, else the id itself. */
export function nameOf(f: Resolved, id: string): string {
	const i = f.idx;
	const named =
		i.units.get(id) ??
		i.items.get(id) ??
		i.upgrades.get(id) ??
		i.keywords.get(id) ??
		i.patrons.get(id);
	if (named) return named.name;
	const line = i.lines.get(id);
	if (line) return i.items.get(line.item)?.name ?? id;
	if (id === f.faction.id) return f.faction.name;
	const other = f.set.factions.find((x) => x.id === id) ?? f.set.variants.find((x) => x.id === id);
	if (other) return other.name;
	for (const p of f.set.patrons) for (const s of p.skills) if (s.id === id) return s.name;
	return id;
}
