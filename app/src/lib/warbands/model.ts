/**
 * Each fighter as the checks see it: its unit, the kit it carries (fixed kit first, then bought, each with the
 * armoury line that prices it and the stipulations it has on this unit), its upgrades, and the keywords it has now
 * (its unit's, its upgrades', its skills' and injuries', ELITE, the variant's LEADER, FIRETEAM).
 *
 * Reused from archive/carcass-front-v1:app/src/lib/builder-state.ts (modelKeywords, armourOf) and
 * app/src/lib/warband-rules.ts (asCarried, handsOf), rewritten to ids and the rules folder format.
 */
import { limit as limitSchema } from '../rules/pack.ts';
import type { ArmouryLine, Item, Limit, Stipulations, Unit, Upgrade } from '../rules/pack.ts';
import { effectsOf } from './progression.ts';
import { isEl, type Resolved } from './resolve.ts';
import { isActive, letters, switchesOf } from './types.ts';
import type { Fighter, Options, WarbandState } from './types.ts';

export type KwRef = { kw: string; value?: string | number };

export interface Carried {
	item: Item;
	/** The armoury line that prices it here, if any. */
	line?: ArmouryLine;
	fixed: boolean;
	stip: Stipulations;
	/** Its keyword ids as this unit carries it (dropKeywords taken away). */
	kws: string[];
}

export interface Model {
	fighter: Fighter;
	unit: Unit;
	category: Unit['category'];
	keywords: Set<string>;
	refs: KwRef[];
	upgrades: Upgrade[];
	/** Skills and injuries: a selector's `skills` matches either. */
	skills: string[];
	items: Carried[];
	/** Building limits its skills and injuries bring (a lost arm, no HEAVY kit). */
	limits: Limit[];
	base?: number;
}

/** The lines a unit may buy from: a Mercenary's own pool first, then the faction's (and its Glory table's). */
export function linesFor(f: Resolved, unit: Unit): ArmouryLine[] {
	if (unit.category !== 'mercenary' || unit.owner === f.faction.id) return f.lines;
	return [...f.set.armouryLines.filter((l) => l.owner === unit.owner), ...f.lines];
}

export const lineFor = (f: Resolved, unit: Unit, itemId: string) =>
	linesFor(f, unit).find((l) => l.item === itemId);

/** The item a bought line holds (undefined for an unknown line). */
export const itemOf = (f: Resolved, lineId: string) => f.idx.lines.get(lineId)?.item;

/**
 * The line to take an item from when only the item is named (an import, a legal list): the faction's (or
 * variant's) own, else the Mercenary's pool, else a Glory or exploration line. `ambiguous` when the chosen source
 * has more than one line for it.
 */
export function bestLine(f: Resolved, unit: Unit | undefined, itemId: string) {
	const own = new Set([f.faction.id, f.variant?.id]);
	const all = [
		...(unit ? linesFor(f, unit) : f.lines).filter((l) => l.item === itemId),
		...f.lines.filter((l) => l.item === itemId)
	].filter((l, i, xs) => xs.indexOf(l) === i);
	const tiers = [
		all.filter((l) => own.has(l.owner)),
		all.filter(
			(l) => !own.has(l.owner) && unit?.category === 'mercenary' && l.owner === unit.owner
		),
		all.filter(
			(l) => !own.has(l.owner) && !(unit?.category === 'mercenary' && l.owner === unit.owner)
		)
	];
	const tier = tiers.find((t) => t.length) ?? [];
	return { line: tier[0], ambiguous: tier.length > 1 ? tier : undefined };
}

/** An item as this unit carries it: its entry may give it other stipulations, or take keywords away. */
export function carry(
	f: Resolved,
	unit: Unit,
	itemId: string,
	fixed: boolean,
	line = lineFor(f, unit, itemId)
): Carried | null {
	const item = f.idx.items.get(itemId);
	if (!item) return null;
	const own = unit.kit.items?.[itemId] ?? (line ? unit.kit.items?.[line.id] : undefined);
	const stip: Stipulations = { ...(line?.stipulations ?? {}), ...(own ?? {}) };
	const drop = new Set(stip.dropKeywords ?? []);
	return {
		item,
		line,
		fixed,
		stip,
		kws: item.keywords.map((k) => k.kw).filter((k) => !drop.has(k))
	};
}

/** Is a fighter ELITE: recruited as one, or promoted into the Elites. */
export const isElite = (fighter: Fighter, unit: Unit) =>
	fighter.group === 'elite' || unit.category === 'elite';

export function buildModel(
	state: WarbandState,
	f: Resolved,
	fighter: Fighter,
	extra: { kit?: string[]; upgrades?: string[] } = {}
): Model | null {
	const unit = f.idx.units.get(fighter.unitId);
	if (!unit) return null;
	const upgradeIds = [...fighter.upgrades, ...(extra.upgrades ?? [])];
	const upgrades = upgradeIds.map((id) => f.idx.upgrades.get(id)).filter((u): u is Upgrade => !!u);
	const items = [
		...(unit.kit.fixed ?? []).map((id) => carry(f, unit, id, true)),
		...[...fighter.kit, ...(extra.kit ?? [])].map((id) => {
			const line = f.idx.lines.get(id);
			return line ? carry(f, unit, line.item, false, line) : null;
		})
	].filter((c): c is Carried => !!c);
	const skills = [...fighter.skills, ...fighter.injuries];
	const fx = effectsOf(skills, f.set.tables);
	// A faction or variant grant (Undead Horror) is every model's, the Mercenaries' excepted.
	const granted = unit.category === 'mercenary' ? [] : f.rules.grant;
	const refs: KwRef[] = [
		...unit.keywords,
		...granted,
		...upgrades.flatMap((u) => u.keywords ?? [])
	];
	const kws = new Set(refs.map((r) => r.kw));
	for (const k of fx.keywords) kws.add(k);
	for (const k of fx.removed) kws.delete(k);
	if (isElite(fighter, unit)) kws.add(f.kw.elite);
	if (f.rules.leader && isEl(f, f.rules.leader, unit)) kws.add(f.kw.leader);
	if (state.fireteams.some((t) => t.includes(fighter.id))) kws.add(f.kw.fireteam);
	const limits = fx.limits.flatMap((l) => {
		const r = limitSchema.safeParse(l);
		return r.success ? [r.data] : [];
	});
	const base = Number.parseInt(unit.stats.base ?? '');
	return {
		fighter,
		unit,
		category: fighter.group === 'elite' ? 'elite' : unit.category,
		keywords: kws,
		refs,
		upgrades,
		skills,
		items,
		limits,
		base: Number.isFinite(base) ? base : undefined
	};
}

/** The warband's fighters on the table (the dead are not), as models. Fighters of unknown units are left out. */
export function buildModels(state: WarbandState, f: Resolved): Model[] {
	return state.fighters
		.filter(isActive)
		.map((x) => buildModel(state, f, x))
		.filter((m): m is Model => !!m);
}

/** The hands a model has for weapons: two of each, unless its entry or an upgrade gives more. */
export function handsOf(m: Model) {
	const pick = (k: 'ranged' | 'melee') =>
		Math.max(m.unit.kit.hands?.[k] ?? 2, ...m.upgrades.map((u) => u.hands?.[k] ?? 0));
	return { ranged: pick('ranged'), melee: pick('melee') };
}

/** Is fixed kit paid for: only kit flagged `includedInCost` when the campaign reads Q65 as (b). */
export const fixedPaid = (m: Pick<Model, 'unit'>, state: WarbandState, opts?: Options) =>
	!!m.unit.kit.includedInCost && switchesOf(state, opts).q65 === 'b';

/**
 * What a model is worth in Ducats, at book prices: its entry and upgrades, and its bought kit. Glory-priced things
 * add nothing (Q38).
 */
export function valueOf(m: Model, state: WarbandState, opts?: Options): number {
	const d = (x: { cost: number; currency: string } | undefined) =>
		x && x.currency === 'ducats' ? x.cost : 0;
	const paidFixed = fixedPaid(m, state, opts);
	return (
		d(m.unit) +
		m.upgrades.reduce((s, u) => s + d(u), 0) +
		m.items.reduce((s, c) => s + (c.fixed && !paidFixed ? 0 : d(c.line)), 0)
	);
}

/** Has the model this keyword, by id; NEGATE <keyword> counts as not being affected by it. */
export const negates = (m: Model, f: Resolved, kw: string) =>
	m.refs.some(
		(r) => r.kw === f.kw.negate && (r.value === kw || letters(String(r.value)) === letters(kw))
	);

/**
 * The Armour characteristic with the model's bought armour and shield: each brings its INJURY MODIFIER keyword's
 * value (fixed kit is already in the printed profile).
 */
export function armourOf(m: Model, f: Resolved): string {
	let v = Number.parseInt(m.unit.stats.armour ?? '0') || 0;
	for (const c of m.items) {
		if (c.fixed || (c.item.category !== 'armour' && c.item.category !== 'shield')) continue;
		for (const r of c.item.keywords) {
			const k = f.idx.keywords.get(r.kw);
			if (!k || !/injury\s*modifier/i.test(k.name)) continue;
			const n = Number.parseInt(String(r.value ?? k.name.match(/[+-]\d+/)?.[0] ?? ''));
			if (Number.isFinite(n)) v += n;
		}
	}
	return v > 0 ? `+${v}` : String(v);
}
