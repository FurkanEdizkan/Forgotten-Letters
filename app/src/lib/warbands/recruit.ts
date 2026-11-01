/**
 * Recruiting with choices: the entry with the upgrades and the loadout picked in the Add fighter dialog, checked as
 * one purchase. Each step is the engine's own check (canRecruit, then canUpgrade at recruit time, then canEquip for
 * each piece) against the warband as the steps before left it, the banks paid as it goes, so every reason is said
 * once. `loadoutOptions` lists a unit's loadouts as concrete line choices to pick from.
 */
import { canEquip, canRecruit, canUpgrade } from './checks.ts';
import { bestLine } from './model.ts';
import { newFighter, priceOf } from './prices.ts';
import { nameOf, type Resolved } from './resolve.ts';
import { no, OK, type Check, type Options, type WarbandState } from './types.ts';

export interface Pick {
	upgrades?: string[];
	/** Armoury line ids, as a loadout option gives them. */
	kit?: string[];
}

const pay = (s: WarbandState, cost: number, currency: 'ducats' | 'glory'): WarbandState =>
	currency === 'glory'
		? { ...s, unspentGlory: s.unspentGlory - cost }
		: { ...s, stashDucats: s.stashDucats - cost };

export function canRecruitWith(
	state: WarbandState,
	f: Resolved,
	unitId: string,
	pick: Pick = {},
	opts?: Options,
	id = `(new ${state.fighters.length})`
): Check {
	const first = canRecruit(state, f, unitId, opts);
	const unit = f.idx.units.get(unitId);
	if (!unit) return first;
	const reasons = first.ok ? [] : [...first.reasons];
	const p = priceOf(state, f, { unitId }, opts);
	let s = pay(
		{ ...state, fighters: [...state.fighters, newFighter(unit, id)] },
		p.cost,
		p.currency
	);
	const edit = (fn: (x: WarbandState['fighters'][number]) => WarbandState['fighters'][number]) => {
		s = { ...s, fighters: s.fighters.map((x) => (x.id === id ? fn(x) : x)) };
	};
	for (const up of pick.upgrades ?? []) {
		const c = canUpgrade(s, f, id, up, { ...opts, later: false });
		if (!c.ok) reasons.push(...c.reasons);
		const u = f.upgrades.find((x) => x.id === up);
		if (u) s = pay(s, u.cost, u.currency);
		edit((x) => ({ ...x, upgrades: [...x.upgrades, up] }));
	}
	for (const line of pick.kit ?? []) {
		const c = canEquip(s, f, id, line, opts);
		if (!c.ok) reasons.push(...c.reasons);
		const lp = f.idx.lines.has(line) ? priceOf(s, f, { lineId: line, fighterId: id }, opts) : null;
		if (lp) s = pay(s, lp.cost, lp.currency);
		edit((x) => ({ ...x, kit: [...x.kit, line] }));
	}
	return reasons.length ? no(...new Set(reasons)) : OK;
}

/** Every way to fill a unit's loadouts, as the lines to buy (fixed kit is already carried); at most `max`. */
export function loadoutOptions(f: Resolved, unitId: string, max = 24) {
	const unit = f.idx.units.get(unitId);
	const out: { label: string; lines: string[] }[] = [];
	for (const l of unit?.kit.loadouts ?? []) {
		let combos: string[][] = [[]];
		for (const slot of l)
			combos = combos.flatMap((c) => (Array.isArray(slot) ? slot : [slot]).map((i) => [...c, i]));
		for (const items of combos) {
			if (out.length >= max) return out;
			const bought = items.filter((i) => !unit!.kit.fixed?.includes(i));
			const lines = bought.map((i) => bestLine(f, unit, i).line?.id);
			if (lines.some((x) => !x)) continue;
			out.push({ label: items.map((i) => nameOf(f, i)).join(' and '), lines: lines as string[] });
		}
	}
	return out;
}
