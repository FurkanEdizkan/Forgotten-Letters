/**
 * What a warband holds beside its roster: the Arsenal (the stash: kit bought but not carried, priced at its line),
 * the fireteams and the locations. Kit leaving or moving is in `warband-items.ts`. Changes run through the same
 * lock and checks as the roster's (warband-state).
 */
import { canStash, priceOf, stashCost, type WarbandState } from '#lib/warbands';
import type { ApiArmouryLine } from '#lib/schemas/warbands';
import { db } from '../db';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import { allowChange, change, decide, load, type Loaded } from './warband-state';

// ---------------------------------------------------------------- stash

/** What the stash change costs the banks (stash kit is priced at its line). */
const stashBanks = (l: Loaded, after: WarbandState) => {
	const a = stashCost(l.state, l.f);
	const b = stashCost(after, l.f);
	return {
		stashDucats: l.state.stashDucats - (b.ducats - a.ducats),
		unspentGlory: l.state.unspentGlory - (b.glory - a.glory)
	};
};

/** What may be bought into the stash: the warband's armoury lines, with price and whether it may now. */
export async function stashLines(ctx: Ctx, id: string): Promise<ApiArmouryLine[]> {
	const l = await load(db(), ctx, id);
	return l.f.lines.map((line) => {
		const c = canStash(l.state, l.f, line.id, l.opts);
		const p = priceOf(l.state, l.f, { lineId: line.id }, l.opts);
		const item = l.f.idx.items.get(line.item);
		return {
			lineId: line.id,
			itemId: line.item,
			name: item?.name ?? line.item,
			category: item?.category ?? 'equipment',
			price: p.cost,
			currency: p.currency,
			ok: c.ok,
			reasons: c.ok ? [] : c.reasons
		};
	});
}

/** Buy kit into the stash, paid from the banks. */
export function stashBuy(ctx: Ctx, id: string, lineId: string) {
	return change(ctx, id, async (tx, l) => {
		decide(l, canStash(l.state, l.f, lineId, l.opts));
		const after = { ...l.state, stash: [...l.state.stash, lineId] };
		await repo.update(tx, l.w.id, { stash: after.stash, ...stashBanks(l, after) });
	});
}

// ---------------------------------------------------------------- fireteams and locations

/** Replace the fireteams (pairs of fighters on the table). */
export function setFireteams(ctx: Ctx, id: string, fireteams: [string, string][]) {
	return change(ctx, id, async (tx, l) => {
		allowChange(l, { ...l.state, fireteams });
		await repo.update(tx, l.w.id, { fireteams });
	});
}

/** Replace the locations the warband holds (a name and a note each). */
export function setLocations(ctx: Ctx, id: string, locations: { name: string; note?: string }[]) {
	return change(ctx, id, async (tx, l) => {
		await repo.update(tx, l.w.id, { locations });
	});
}
