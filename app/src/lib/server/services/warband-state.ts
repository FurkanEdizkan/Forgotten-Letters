/**
 * The warband service's shared core: load a warband for the caller (its owner edits it; the CM and co-CMs of the
 * campaign it sits in read it), turn the rows into the engine's state with its rules set and options, decide a
 * checked change (refused with the engine's reasons unless the campaign lets warbands go beyond their limits), and
 * shape what the pages and the API show.
 */
import {
	canChange,
	rating,
	resolveFaction,
	type Check,
	type Fighter,
	type Options,
	type Resolved,
	type SetWithBase,
	type WarbandState
} from '#lib/warbands';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as campaignsRepo from '../repos/campaigns';
import * as repo from '../repos/warbands';
import type { Ctx, SessionUser } from './audit';
import { requireUser } from './auth';
import { rulesSetOf } from './rules';
import { viewOf } from './warband-view';

export { cardOf, viewOf } from './warband-view';

export const notFound = () => new AppError('not_found', 'No such warband.');
export const stale = () =>
	new AppError(
		'conflict',
		'Someone changed this warband a moment ago. Reload to see the change, then try again.'
	);

/** A refused change: the engine's reasons in the message, one per field `reason1`, `reason2`, … */
export function refused(reasons: string[]) {
	return new AppError(
		'conflict',
		`Not allowed: ${reasons.join('; ')}.`,
		Object.fromEntries(reasons.map((r, i) => [`reason${i + 1}`, r]))
	);
}

export interface Loaded {
	w: repo.WarbandRow;
	rows: repo.FighterRow[];
	seat: repo.SeatOf | null;
	set: SetWithBase;
	f: Resolved;
	opts: Options;
	state: WarbandState;
	canEdit: boolean;
	me: SessionUser;
}

/**
 * The engine's options for a warband in this seat: beyond limits if the CM allows it (outside a campaign, if the
 * warband's own "ignore limits" switch is on); Q37 once play has begun.
 */
export const optionsFor = (
	seat: Pick<repo.SeatOf, 'allowBeyondLimits' | 'stage'> | null,
	w?: Pick<repo.WarbandRow, 'ignoreLimits'>
): Options => ({
	allowBeyondLimits: seat ? seat.allowBeyondLimits : !!w?.ignoreLimits,
	later: seat?.stage === 'active'
});

/** The faction a warband is built from, in its rules; a version that dropped it is a conflict to fix, not a crash. */
export async function resolveFor(
	rules: { rulesSet: string; rulesExpansions: string[] },
	factionId: string,
	variantId: string | null,
	dedication?: string | null
) {
	const set = await rulesSetOf(rules.rulesSet, rules.rulesExpansions);
	try {
		return {
			set,
			f: resolveFaction(set, factionId, variantId ?? undefined, dedication ?? undefined)
		};
	} catch {
		throw new AppError(
			'conflict',
			`These rules (${[rules.rulesSet, ...rules.rulesExpansions].join(' + ')}) have no ${variantId ?? factionId}.`
		);
	}
}

export const toFighter = (r: repo.FighterRow): Fighter => ({
	id: r.id,
	unitId: r.unitId,
	...(r.name ? { name: r.name } : {}),
	group: r.grp,
	kit: r.kit,
	upgrades: r.upgrades,
	skills: r.skills,
	injuries: r.injuries,
	xp: r.xp,
	status: r.status,
	scars: r.battleScars
});

export const stateOf = (
	w: repo.WarbandRow,
	rows: repo.FighterRow[],
	set: SetWithBase
): WarbandState => ({
	setId: set.manifest.id,
	name: w.name,
	factionId: w.factionId,
	...(w.variantId ? { variantId: w.variantId } : {}),
	...(w.patronId ? { patronId: w.patronId } : {}),
	...(w.dedication ? { dedication: w.dedication } : {}),
	ducatLimit: w.ducatLimit,
	stashDucats: w.stashDucats,
	unspentGlory: w.unspentGlory,
	fighters: rows.map(toFighter),
	stash: w.stash,
	fireteams: w.fireteams,
	locations: w.locations
});

/**
 * Who may see a warband: its owner may change it; the CM and co-CMs of the campaign it sits in may read it. Anyone
 * else gets `not_found`, so other people's warbands do not leak. `edit` refuses a reader with `forbidden`.
 */
export async function see(
	tx: Tx,
	ctx: Ctx,
	id: string,
	opts: { lock?: boolean; edit?: boolean } = {}
) {
	const me = requireUser(ctx);
	const w = await (opts.lock ? repo.lock(tx, id) : repo.findById(tx, id));
	if (!w) throw notFound();
	const [found] = await repo.seatsOf(tx, [id]);
	const seat = found && !found.deletedAt ? found : null;
	const canEdit = w.ownerId === me.id;
	if (!canEdit) {
		const role = seat ? await campaignsRepo.roleOf(tx, seat.campaignId, me.id) : null;
		if (!role) throw notFound();
		if (opts.edit) throw new AppError('forbidden', 'Only its owner can change a warband.');
	}
	return { w, seat, canEdit, me };
}

/** Load a warband the caller may see, with its fighters, rules, engine state and options. */
export async function load(
	tx: Tx,
	ctx: Ctx,
	id: string,
	opts: { lock?: boolean; edit?: boolean } = {}
): Promise<Loaded> {
	const { w, seat, canEdit, me } = await see(tx, ctx, id, opts);
	const rows = await repo.fightersOf(tx, [id]);
	const { set, f } = await resolveFor(w, w.factionId, w.variantId, w.dedication);
	return {
		w,
		rows,
		seat,
		set,
		f,
		opts: optionsFor(seat, w),
		state: stateOf(w, rows, set),
		canEdit,
		me
	};
}

/** Refuse a failed check, unless the campaign lets this warband go beyond its limits (it is then a warning). */
export function decide(l: Pick<Loaded, 'opts'>, check: Check) {
	if (!check.ok && !l.opts.allowBeyondLimits) throw refused(check.reasons);
}

/** A change with no check of its own may leave the list unfinished but never newly break a maximum. */
export const allowChange = (l: Loaded, after: WarbandState) =>
	decide(l, canChange(l.state, after, l.f, l.opts));

/** What a change costs the banks: the worth it adds to the fighters (or the stash), taken from them. */
export function banksAfter(l: Loaded, after: WarbandState) {
	const a = rating(l.state, l.f, l.opts);
	const b = rating(after, l.f, l.opts);
	return {
		stashDucats: after.stashDucats - (b.ducats - a.ducats),
		unspentGlory: after.unspentGlory - (b.glory - a.glory)
	};
}

/** Load again after a change (same transaction) and shape it. */
export async function reloadView(tx: Tx, ctx: Ctx, id: string) {
	return viewOf(tx, await load(tx, ctx, id));
}

/** Run a change on a locked warband the caller owns, then answer the warband as it is now. */
export const change = (ctx: Ctx, id: string, run: (tx: Tx, l: Loaded) => Promise<void>) =>
	db().transaction(async (tx) => {
		const l = await load(tx, ctx, id, { lock: true, edit: true });
		await run(tx, l);
		return reloadView(tx, ctx, id);
	});

/** One fighter of a loaded warband, or `not_found`. */
export function fighterOf(l: Loaded, fid: string) {
	const x = l.state.fighters.find((y) => y.id === fid);
	if (!x) throw new AppError('not_found', 'No such fighter in this warband.');
	return x;
}

/** Save the banks after a fighter change (and bump the warband's version). */
export const payFor = (tx: Tx, l: Loaded, after: WarbandState, extra: repo.WarbandFields = {}) =>
	repo.update(tx, l.w.id, { ...banksAfter(l, after), ...extra });
