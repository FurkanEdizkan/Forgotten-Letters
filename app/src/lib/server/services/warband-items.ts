/**
 * Bought kit leaving or moving: a piece of a fighter's kit or of the Arsenal is sold (half its price back, rounded
 * up, in its own currency), refunded (all of it, only before the warband's first game, a Trench Companion
 * convenience) or deleted (nothing back); or it moves between fighters and the Arsenal with no money changing
 * hands. Every change runs through the warband's lock and checks (warband-state).
 */
import { campaign, canEquip, type Price, type WarbandState } from '#lib/warbands';
import { AppError } from '../errors';
import type { Tx } from '../db';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import { allowChange, change, decide, fighterOf, type Loaded } from './warband-state';

export type Leave = 'sell' | 'refund' | 'delete';
export type Holder = string | 'arsenal';

const withoutOne = (xs: string[], x: string, what: string) => {
	const at = xs.lastIndexOf(x);
	if (at < 0) throw new AppError('not_found', `${what} holds no such kit.`);
	return xs.filter((_, i) => i !== at);
};

/** The banks after kit worth `lost` leaves the warband in this way. */
function banksFor(l: Loaded, lost: Price, mode: Leave) {
	if (mode === 'refund' && !campaign.canRefund(l.w.gamesPlayed))
		throw new AppError(
			'conflict',
			'The warband has played a game: sell the kit for half its price instead of a refund.'
		);
	const back =
		mode === 'delete' ? { ducats: 0, glory: 0 } : mode === 'sell' ? campaign.sellValue(lost) : lost;
	return {
		stashDucats: l.state.stashDucats + back.ducats,
		unspentGlory: l.state.unspentGlory + back.glory
	};
}

/** The same warband with its banks and limit out of the way, so a move is checked for everything but money. */
const unpaid = (s: WarbandState): WarbandState => ({
	...s,
	stashDucats: 1e9,
	unspentGlory: 1e9,
	ducatLimit: 1e9
});

function take(l: Loaded, from: Holder, lineId: string): WarbandState {
	if (from === 'arsenal')
		return { ...l.state, stash: withoutOne(l.state.stash, lineId, 'The Arsenal') };
	const x = fighterOf(l, from);
	const kit = withoutOne(x.kit, lineId, 'That fighter');
	return {
		...l.state,
		fighters: l.state.fighters.map((y) => (y.id === from ? { ...y, kit } : y))
	};
}

async function save(tx: Tx, l: Loaded, after: WarbandState) {
	for (const y of after.fighters) {
		const before = l.state.fighters.find((z) => z.id === y.id);
		if (before && before.kit !== y.kit) await repo.updateFighter(tx, y.id, { kit: y.kit });
	}
}

/** One piece of bought kit leaves a fighter or the Arsenal: sold, refunded or deleted. Fixed kit never does. */
export function leave(ctx: Ctx, id: string, from: Holder, lineId: string, mode: Leave) {
	return change(ctx, id, async (tx, l) => {
		const after = take(l, from, lineId);
		allowChange(l, after);
		// The same value the builder shows for the piece (shared, so they cannot drift apart).
		const lost = campaign.pieceValue(l.state, l.f, from, lineId, l.opts);
		await save(tx, l, after);
		await repo.update(tx, l.w.id, {
			...(from === 'arsenal' ? { stash: after.stash } : {}),
			...banksFor(l, lost, mode)
		});
	});
}

/**
 * Move one piece of bought kit from a fighter or the Arsenal to another fighter or the Arsenal. A fighter that
 * takes it is checked as for buying it (its entry, the line's stipulations, limits), except for money.
 */
export function move(ctx: Ctx, id: string, lineId: string, from: Holder, to: Holder) {
	return change(ctx, id, async (tx, l) => {
		if (from === to) throw new AppError('invalid', 'Pick another fighter or the Arsenal.');
		const taken = take(l, from, lineId);
		let after: WarbandState;
		if (to === 'arsenal') after = { ...taken, stash: [...taken.stash, lineId] };
		else {
			const x = taken.fighters.find((y) => y.id === to);
			if (!x) throw new AppError('not_found', 'No such fighter in this warband.');
			decide(l, canEquip(unpaid(taken), l.f, to, lineId, l.opts));
			const kit = [...x.kit, lineId];
			after = { ...taken, fighters: taken.fighters.map((y) => (y.id === to ? { ...y, kit } : y)) };
		}
		if (to === 'arsenal') allowChange(l, after);
		await save(tx, l, after);
		if (from === 'arsenal' || to === 'arsenal')
			await repo.update(tx, l.w.id, { stash: after.stash });
		else await repo.update(tx, l.w.id, {});
	});
}
