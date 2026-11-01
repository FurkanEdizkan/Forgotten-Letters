/**
 * What a warband holds beside its roster: the stash (kit bought but not carried, priced at its line), the
 * fireteams and the locations. Changes run through the same lock and checks as the roster's (warband-state).
 */
import { canEquip, canStash, priceOf, stashCost, type WarbandState } from '#lib/warbands';
import type { ApiArmouryLine } from '#lib/schemas/warbands';
import { AppError } from '../errors';
import { db } from '../db';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import {
	allowChange,
	banksAfter,
	change,
	decide,
	fighterOf,
	load,
	type Loaded
} from './warband-state';

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

const withoutOne = (xs: string[], x: string) => {
	const at = xs.lastIndexOf(x);
	if (at < 0) throw new AppError('not_found', 'The stash holds no such kit.');
	return xs.filter((_, i) => i !== at);
};

/** Sell one piece from the stash; its price goes back to the banks. */
export function stashSell(ctx: Ctx, id: string, lineId: string) {
	return change(ctx, id, async (tx, l) => {
		const after = { ...l.state, stash: withoutOne(l.state.stash, lineId) };
		await repo.update(tx, l.w.id, { stash: after.stash, ...stashBanks(l, after) });
	});
}

/**
 * Give a piece from the stash to a fighter: sold from the stash and bought for the fighter in one step, so the
 * fighter's checks (and its price) apply as for any purchase.
 */
export function stashGive(ctx: Ctx, id: string, lineId: string, fid: string) {
	return change(ctx, id, async (tx, l) => {
		const x = fighterOf(l, fid);
		const stash = withoutOne(l.state.stash, lineId);
		const refunded = { ...l.state, stash, ...stashBanks(l, { ...l.state, stash }) };
		decide(l, canEquip(refunded, l.f, fid, lineId, l.opts));
		const kit = [...x.kit, lineId];
		const after = {
			...refunded,
			fighters: refunded.fighters.map((y) => (y.id === fid ? { ...y, kit } : y))
		};
		await repo.updateFighter(tx, fid, { kit });
		await repo.update(tx, l.w.id, { stash, ...banksAfter({ ...l, state: refunded }, after) });
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
