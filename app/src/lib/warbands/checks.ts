/**
 * May the warband do this now: recruit an entry, give a fighter an item, an upgrade, or put an item in the stash?
 * Each check says every reason it is refused: the entry's and the line's stipulations, the Battlekit Limits, a
 * `max` limit the change newly breaks, and the money (paid from the banks; the fighters' worth stays within the
 * ducat limit). `min` limits are not refusals: they are issues of the finished list (issues.ts).
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (recruitCheck, equipCheck, upgradeCheck,
 * stashCheck), rewritten to ids and the rules folder format.
 */
import type { ArmouryLine, Unit, Upgrade } from '../rules/pack.ts';
import { battlekitCheck } from './battlekit.ts';
import { describeModels } from './describe.ts';
import { limitIssues, loadoutCheck, newlyBroken, scopedLimits } from './limits.ts';
import {
	buildModels,
	carry,
	isElite,
	itemOf,
	linesFor,
	type Carried,
	type Model
} from './model.ts';
import { newFighter, priceOf, rating, type Buy } from './prices.ts';
import { excludedItem, isEl, nameOf, type Resolved } from './resolve.ts';
import { matchModel, onlyPhrase, type Ctx } from './select.ts';
import { coin, isActive, no, OK, switchesOf } from './types.ts';
import type { Check, Fighter, Options, WarbandState } from './types.ts';

const verdict = (reasons: string[]): Check => (reasons.length ? no(...reasons) : OK);

/** The blocking limits a changed warband newly breaks. */
export function broken(before: WarbandState, after: WarbandState, f: Resolved, opts?: Options) {
	const issues = (s: WarbandState) => {
		const ctx: Ctx = { f, state: s, opts };
		const models = buildModels(s, f);
		return limitIssues(models, scopedLimits(models, ctx), ctx);
	};
	return newlyBroken(issues(before), issues(after));
}

/** Can the banks pay, and do the fighters stay within the ducat limit afterwards? */
function money(price: Buy, before: WarbandState, after: WarbandState, f: Resolved, opts?: Options) {
	const out: string[] = [];
	const bank = price.currency === 'glory' ? before.unspentGlory : before.stashDucats;
	if (price.cost > bank)
		out.push(`Costs ${price.cost} ${coin(price.currency)}; ${bank} in the strongbox`);
	const r = rating(after, f, opts).ducats;
	if (price.currency === 'ducats' && price.cost > 0 && r > before.ducatLimit)
		out.push(`Over the ducat limit (${r} of ${before.ducatLimit})`);
	return out;
}

/** Why an entry may not be in this warband at all (not its list, not hired, excluded, never recruited). */
export function unitReasons(f: Resolved, unit: Unit): string[] {
	const name = unit.name;
	if (
		f.rules.excluded.includes(unit.id) ||
		(unit.category === 'mercenary' && f.rules.excluded.includes('faction:mercenaries'))
	)
		return [
			`${f.name} cannot include ${unit.category === 'mercenary' && !f.rules.excluded.includes(unit.id) ? 'Mercenaries' : name}`
		];
	if (unit.category === 'mercenary' && !f.mercenaries.includes(unit))
		return [`Not hired by ${f.name}`];
	if (unit.category !== 'mercenary' && !f.units.includes(unit))
		return [`${name} is not in the ${f.name} list`];
	if (unit.kit.recruit === false) return [`A ${name} is not recruited; it joins another way`];
	return [];
}

/** The cap on an entry: the faction's cap for it, else its availability. */
export const capOf = (f: Resolved, unit: Unit) =>
	f.rules.caps.find((c) => isEl(f, c.unit, unit))?.max ?? unit.availability.max;

export function canRecruit(
	state: WarbandState,
	f: Resolved,
	unitId: string,
	opts?: Options
): Check {
	const unit = f.idx.units.get(unitId);
	if (!unit) return no(`No unit ${unitId}`);
	const reasons = unitReasons(f, unit);
	if (reasons.length) return no(...reasons);
	const active = state.fighters.filter(isActive);
	const fielded = active.filter((x) => x.unitId === unit.id).length;
	const cap = capOf(f, unit);
	if (cap != null && fielded >= cap) reasons.push(`Limit reached (${fielded}/${cap})`);
	const elites = active.filter((x) => {
		const u = f.idx.units.get(x.unitId);
		return !!u && isElite(x, u);
	}).length;
	if ((unit.category === 'elite' || unit.keywords.some((k) => k.kw === f.kw.elite)) && elites >= 6)
		reasons.push('A warband can have at most 6 ELITE models');
	const id = `(new ${state.fighters.length})`;
	const after = { ...state, fighters: [...state.fighters, newFighter(unit, id)] };
	reasons.push(...money(priceOf(state, f, { unitId }, opts), state, after, f, opts));
	reasons.push(...broken(state, after, f, opts));
	return verdict(reasons);
}

/** Copies of a line's item that count towards its warband-wide Limit (kit on the table and in the stash). */
export function limitCount(line: ArmouryLine, models: Model[], state: WarbandState, ctx: Ctx) {
	const { f } = ctx;
	const ex = line.stipulations?.limitExcludes;
	const on = models
		.filter((m) => !ex || !matchModel(m, ex, ctx))
		.reduce((n, m) => n + m.items.filter((c) => c.item.id === line.item).length, 0);
	return on + state.stash.filter((l) => itemOf(f, l) === line.item).length;
}

/**
 * Why this model may not carry this item, apart from limits and money: its entry's rules, the line's stipulations,
 * the Battlekit Limits and its loadouts. `m` is the model before it takes the item.
 */
export function kitReasons(m: Model, c: Carried, ctx: Ctx): string[] {
	const { f, opts } = ctx;
	const name = m.unit.name;
	const k = m.unit.kit;
	if (k.nothingElse) return [`A ${name} cannot have any other Battlekit`];
	if (k.except?.includes(c.item.category))
		return [
			`A ${name} cannot take ${c.item.category === 'armour' ? 'Armour' : `${c.item.category} kit`}`
		];
	const out: string[] = [];
	if (c.stip.explorationOnly && !opts?.openExploration)
		out.push('Needs an Exploration discovery (the Campaign Master opens it)');
	if (c.stip.only && !matchModel(m, c.stip.only, ctx))
		out.push(onlyPhrase(c.stip.only, f, (s) => describeModels(f, s)));
	const copies = m.items.filter((x) => x.item.id === c.item.id).length;
	if (c.stip.perModel != null && copies >= c.stip.perModel)
		out.push(`${c.stip.perModel} per model`);
	const bk = battlekitCheck(m, c, ctx);
	if (bk) out.push(bk);
	if (k.loadouts?.length) {
		const bad = loadoutCheck(
			[...m.items.map((x) => x.item.id), c.item.id],
			k.loadouts,
			false,
			(i) => nameOf(f, i)
		);
		if (bad) out.push(bad);
	}
	return out;
}

const withFighter = (state: WarbandState, x: Fighter): WarbandState => ({
	...state,
	fighters: state.fighters.map((y) => (y.id === x.id ? x : y))
});

export function canEquip(
	state: WarbandState,
	f: Resolved,
	fighterId: string,
	lineId: string,
	opts?: Options
): Check {
	const ctx: Ctx = { f, state, opts };
	const models = buildModels(state, f);
	const m = models.find((x) => x.fighter.id === fighterId);
	if (!m) return no(`No fighter ${fighterId} on the table`);
	const line = f.idx.lines.get(lineId);
	const itemName = line ? nameOf(f, line.item) : lineId;
	if (!line || !linesFor(f, m.unit).includes(line))
		return no(
			line && excludedItem(f, line.item)
				? `${itemName} is excluded from this warband's armoury`
				: `${itemName} is not in this warband's armoury`
		);
	const c = carry(f, m.unit, line.item, false, line);
	if (!c) return no(`No item ${line.item}`);
	const reasons = kitReasons(m, c, ctx);
	if (line.limit != null && !(c.stip.limitExcludes && matchModel(m, c.stip.limitExcludes, ctx))) {
		const held = limitCount(line, models, state, ctx);
		if (held >= line.limit) reasons.push(`Limit ${held}/${line.limit} used`);
	}
	const after = withFighter(state, { ...m.fighter, kit: [...m.fighter.kit, line.id] });
	reasons.push(...money(priceOf(state, f, { lineId, fighterId }, opts), state, after, f, opts));
	reasons.push(...broken(state, after, f, opts));
	return verdict(reasons);
}

/** May the unit take this upgrade at all: one it is for, or one its entry lists. */
export const upgradeFor = (f: Resolved, up: Upgrade, unit: Unit) =>
	!!unit.upgrades?.some((x) => isEl(f, x, up)) ||
	!up.for?.length ||
	up.for.some((u) => isEl(f, u, unit));

export function canUpgrade(
	state: WarbandState,
	f: Resolved,
	fighterId: string,
	upgradeId: string,
	opts?: Options
): Check {
	const fighter = state.fighters.find((x) => x.id === fighterId);
	const unit = fighter && f.idx.units.get(fighter.unitId);
	if (!fighter || !unit) return no(`No fighter ${fighterId}`);
	const up = f.upgrades.find((u) => u.id === upgradeId);
	if (!up) return no(`no upgrade "${nameOf(f, upgradeId)}"`);
	const reasons: string[] = [];
	if (!upgradeFor(f, up, unit))
		reasons.push(`${up.name} is for ${(up.for ?? []).map((u) => nameOf(f, u)).join(', ')}`);
	if (fighter.upgrades.includes(up.id)) reasons.push(`Already has ${up.name}`);
	const taken = state.fighters.filter(
		(x) => isActive(x) && x.id !== fighter.id && x.upgrades.includes(up.id)
	).length;
	if (up.max != null && taken >= up.max) reasons.push(`${up.name}: ${taken}/${up.max} taken`);
	// Q37 (a): upgrades are bought when the fighter is recruited, not later, unless the upgrade says otherwise.
	if (opts?.later && !up.afterRecruit && switchesOf(state, opts).q37 === 'a')
		reasons.push(`${up.name} is taken only when the fighter is recruited`);
	const after = withFighter(state, { ...fighter, upgrades: [...fighter.upgrades, up.id] });
	reasons.push(...money(up, state, after, f, opts));
	reasons.push(...broken(state, after, f, opts));
	return verdict(reasons);
}

export function canStash(state: WarbandState, f: Resolved, lineId: string, opts?: Options): Check {
	const line = f.idx.lines.get(lineId);
	if (!line || !f.lines.includes(line))
		return no(`${line ? nameOf(f, line.item) : lineId} is not in this warband's armoury`);
	const reasons: string[] = [];
	if (line.stipulations?.explorationOnly && !opts?.openExploration)
		reasons.push('Needs an Exploration discovery (the Campaign Master opens it)');
	if (line.limit != null) {
		const held = limitCount(line, buildModels(state, f), state, { f, state, opts });
		if (held >= line.limit) reasons.push(`Limit ${held}/${line.limit} used`);
	}
	const after = { ...state, stash: [...state.stash, line.id] };
	reasons.push(...money(priceOf(state, f, { lineId }, opts), state, after, f, opts));
	return verdict(reasons);
}

/** Every entry for the Add fighter dialog, with whether it may be recruited now and why not. */
export const availableUnits = (state: WarbandState, f: Resolved, opts?: Options) =>
	[...f.units, ...f.mercenaries].map((unit) => ({ unit, ...canRecruit(state, f, unit.id, opts) }));

/** Every line a fighter may look at in the Equip dialog, with whether it may take it now and why not. */
export function availableLines(
	state: WarbandState,
	f: Resolved,
	fighterId: string,
	opts?: Options
) {
	const fighter = state.fighters.find((x) => x.id === fighterId);
	const unit = fighter && f.idx.units.get(fighter.unitId);
	if (!unit) return [];
	return linesFor(f, unit).map((line) => ({
		line,
		...canEquip(state, f, fighterId, line.id, opts)
	}));
}
