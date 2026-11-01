/**
 * May the warband take on a copy of a fighter (same entry, upgrades and bought kit; no skills, injuries or
 * Experience)? The copy is recruited, so every recruit check applies, and it brings its upgrades and kit, so their
 * most, the line Limits and the warband's limits count it too. It is paid for whole from the banks.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (copyCheck), rewritten to ids and the rules
 * folder format.
 */
import { broken, canRecruit, limitCount } from './checks.ts';
import { buildModels } from './model.ts';
import { fighterCosts, rating } from './prices.ts';
import { nameOf, type Resolved } from './resolve.ts';
import { isActive, no, OK, type Check, type Options, type WarbandState } from './types.ts';

export function canCopy(
	state: WarbandState,
	f: Resolved,
	fighterId: string,
	opts?: Options
): Check {
	const src = state.fighters.find((x) => x.id === fighterId);
	if (!src) return no(`No fighter ${fighterId}`);
	const recruit = canRecruit(state, f, src.unitId, opts);
	// The entry's own price is checked below with the whole copy's.
	const reasons = recruit.ok
		? []
		: recruit.reasons.filter((r) => !/^Costs |^Over the ducat limit/.test(r));
	const copy = {
		...src,
		id: `(copy ${state.fighters.length})`,
		name: undefined,
		skills: [],
		injuries: [],
		xp: 0,
		paid: undefined
	};
	if (src.group === 'dead') copy.group = f.idx.units.get(src.unitId)?.category ?? 'troop';
	for (const u of copy.upgrades) {
		const up = f.upgrades.find((x) => x.id === u);
		const taken = state.fighters.filter((x) => isActive(x) && x.upgrades.includes(u)).length;
		if (up?.max != null && taken >= up.max) reasons.push(`${up.name}: ${taken}/${up.max} taken`);
	}
	const after = { ...state, fighters: [...state.fighters, copy] };
	const ctx = { f, state: after, opts };
	const models = buildModels(after, f);
	for (const id of new Set(copy.kit)) {
		const line = f.idx.lines.get(id);
		if (line?.limit != null && limitCount(line, models, after, ctx) > line.limit)
			reasons.push(`${nameOf(f, line.item)}: limit ${line.limit} reached`);
	}
	reasons.push(...broken(state, after, f, opts));
	const cost = fighterCosts(after, f, opts).get(copy.id) ?? { ducats: 0, glory: 0 };
	if (cost.ducats > state.stashDucats)
		reasons.push(`Costs ${cost.ducats} Ducats; ${state.stashDucats} in the strongbox`);
	if (cost.glory > state.unspentGlory)
		reasons.push(`Costs ${cost.glory} Glory; ${state.unspentGlory} in the strongbox`);
	const worth = rating(after, f, opts).ducats;
	if (cost.ducats > 0 && worth > state.ducatLimit)
		reasons.push(`Over the ducat limit (${worth} of ${state.ducatLimit})`);
	return reasons.length ? no(...reasons) : OK;
}
