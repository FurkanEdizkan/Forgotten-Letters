/**
 * A warband's campaign seat: the caller's seat in a campaign (one warband in it, one campaign per warband),
 * assigning one of their warbands (re-checked against the campaign's rules when they differ), taking it out, and
 * every seat's warband for the campaign's CM and co-CMs.
 */
import { isHomebrewSet } from '#lib/rules/homebrew';
import { canChange } from '#lib/warbands';
import type { ApiWarband, ApiWarbandCard } from '#lib/schemas/warbands';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/warbands';
import * as seatsRepo from '../repos/seats';
import { record, type Ctx } from './audit';
import { access, ended, need } from './campaigns';
import { homebrewClosure, labeller, listSets } from './rules';
import {
	cardOf,
	load,
	optionsFor,
	refused,
	reloadView,
	resolveFor,
	stateOf
} from './warband-state';

/**
 * The seat a new or assigned warband goes to: the caller's seat in a campaign that has not ended. Locks the
 * campaign row, so two assignments to one campaign run one after the other.
 */
export async function mySeat(tx: Tx, ctx: Ctx, campaignId: string) {
	const a = await access(tx, ctx, campaignId, { lock: true });
	if (a.c.stage === 'ended') throw ended();
	const seat = await seatsRepo.seatOf(tx, campaignId, a.me.id);
	if (!seat) throw new AppError('not_found', 'You do not hold a seat in this campaign.');
	return { a, seat };
}

/** Put a warband in a seat, audited. */
export async function seatWarband(tx: Tx, ctx: Ctx, seatId: string, warbandId: string) {
	await repo.setSeat(tx, seatId, warbandId);
	await record(tx, ctx, 'warband.assigned', { type: 'seat', id: seatId }, { warbandId });
}

const sameRules = (
	a: { rulesSet: string; rulesExpansions: string[] },
	b: { rulesSet: string; rulesExpansions: string[] }
) =>
	a.rulesSet === b.rulesSet &&
	[...a.rulesExpansions].sort().join('+') === [...b.rulesExpansions].sort().join('+');

/**
 * Refuse a warband built on homebrew the campaign does not allow (allowing a set allows the homebrew it builds on).
 */
export async function homebrewAllowed(c: { homebrewSets: string[] }, rulesExpansions: string[]) {
	const hb = rulesExpansions.filter(isHomebrewSet);
	if (!hb.length) return;
	const ok = await homebrewClosure(c.homebrewSets);
	const no = hb.filter((x) => !ok.has(x));
	if (!no.length) return;
	const names = new Map((await listSets(true)).map((s) => [s.id, s.name]));
	const message = `This campaign does not allow the homebrew ${no.map((x) => names.get(x) ?? x).join(', ')}. Ask its Campaign Master to allow it.`;
	throw new AppError('conflict', message, { homebrew: message });
}

/**
 * Put one of my warbands in my seat of a campaign (replacing the one there). Refused while it sits in another
 * campaign, when it is built on homebrew the campaign does not allow, or when the campaign plays other rules,
 * unless `recheck`: then the warband is rebuilt for the campaign's rules (keeping its homebrew) and must be legal
 * there (or the campaign allows going beyond limits).
 */
export async function assignToSeat(
	ctx: Ctx,
	campaignId: string,
	input: { warbandId: string; recheck?: boolean }
): Promise<ApiWarband> {
	return db().transaction(async (tx) => {
		const { a, seat: s } = await mySeat(tx, ctx, campaignId);
		const l = await load(tx, ctx, input.warbandId, { lock: true, edit: true });
		if (l.seat && l.seat.campaignId !== campaignId)
			throw new AppError(
				'conflict',
				`This warband sits in ${l.seat.campaignName}. Take it out of that campaign first.`
			);
		await homebrewAllowed(a.c, l.w.rulesExpansions);
		const hb = l.w.rulesExpansions.filter(isHomebrewSet);
		const own = {
			rulesSet: l.w.rulesSet,
			rulesExpansions: l.w.rulesExpansions.filter((e) => !isHomebrewSet(e))
		};
		if (!sameRules(own, a.c)) {
			const want = [a.c.rulesSet, ...a.c.rulesExpansions].join(' + ');
			if (!input.recheck)
				throw new AppError(
					'conflict',
					`This warband is built for ${[l.w.rulesSet, ...l.w.rulesExpansions].join(' + ')}; the campaign plays ${want}. Re-check it against the campaign's rules to move it over.`,
					{ recheck: want }
				);
			const there = { rulesSet: a.c.rulesSet, rulesExpansions: [...a.c.rulesExpansions, ...hb] };
			const { set, f } = await resolveFor(there, l.w.factionId, l.w.variantId, l.w.dedication);
			const opts = optionsFor({ allowBeyondLimits: a.c.allowBeyondLimits, stage: a.c.stage });
			const state = stateOf(l.w, l.rows, set);
			// Legal there as a change from nothing: an unfinished list may move over, a broken one may not.
			const hard = canChange({ ...state, fighters: [], stash: [], fireteams: [] }, state, f, opts);
			if (!hard.ok && !opts.allowBeyondLimits) throw refused(hard.reasons);
			await repo.update(tx, l.w.id, there);
		}
		if (s.warbandId !== l.w.id) await seatWarband(tx, ctx, s.id, l.w.id);
		return reloadView(tx, ctx, l.w.id);
	});
}

/** Take my warband out of my seat in a campaign; the seat stays mine. */
export async function clearSeat(ctx: Ctx, campaignId: string): Promise<void> {
	await db().transaction(async (tx) => {
		const { seat: s } = await mySeat(tx, ctx, campaignId);
		if (!s.warbandId) return;
		await repo.setSeat(tx, s.id, null);
		await record(
			tx,
			ctx,
			'warband.unassigned',
			{ type: 'seat', id: s.id },
			{ warbandId: s.warbandId }
		);
	});
}

/** Every seat's warband in a campaign, for its CM and co-CMs. */
export async function ofCampaign(ctx: Ctx, campaignId: string) {
	const a = await access(db(), ctx, campaignId);
	need(a, 'manage');
	const seated = await repo.ofCampaign(db(), campaignId);
	const label = await labeller();
	return Promise.all(
		seated.map(async (s) => {
			const l = await load(db(), ctx, s.warbandId!).catch(() => null);
			return {
				seatId: s.seatId,
				seatName: s.seatName,
				warband: l ? cardOf(l.w, l, l.seat, label) : null
			};
		})
	).then((xs) => xs.filter((x): x is typeof x & { warband: ApiWarbandCard } => !!x.warband));
}
