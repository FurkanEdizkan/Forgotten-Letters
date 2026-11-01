/**
 * The warband service's shared core: load a warband for the caller (its owner edits it; the CM and co-CMs of the
 * campaign it sits in read it), turn the rows into the engine's state with its rules set and options, decide a
 * checked change (refused with the engine's reasons unless the campaign lets warbands go beyond their limits), and
 * shape what the pages and the API show.
 */
import {
	canChange,
	fighterCosts,
	issues as issuesOf,
	nameOf,
	rating,
	refName,
	resolveFaction,
	type Check,
	type Fighter,
	type Options,
	type Resolved,
	type SetWithBase,
	type WarbandState
} from '#lib/warbands';
import type { ApiFighter, ApiWarband, ApiWarbandCard } from '#lib/schemas/warbands';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as campaignsRepo from '../repos/campaigns';
import * as repo from '../repos/warbands';
import type { Ctx, SessionUser } from './audit';
import { requireUser } from './auth';
import { rulesSetOf } from './rules';

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

/** The engine's options for a warband in this seat: beyond limits if the CM allows it; Q37 once play has begun. */
export const optionsFor = (
	seat: Pick<repo.SeatOf, 'allowBeyondLimits' | 'stage'> | null
): Options => ({
	allowBeyondLimits: !!seat?.allowBeyondLimits,
	later: seat?.stage === 'active'
});

/** The faction a warband is built from, in its rules; a version that dropped it is a conflict to fix, not a crash. */
export async function resolveFor(
	rules: { rulesSet: string; rulesExpansions: string[] },
	factionId: string,
	variantId: string | null
) {
	const set = await rulesSetOf(rules.rulesSet, rules.rulesExpansions);
	try {
		return { set, f: resolveFaction(set, factionId, variantId ?? undefined) };
	} catch {
		throw new AppError(
			'conflict',
			`These rules (${[rules.rulesSet, ...rules.rulesExpansions].join(' + ')}) have no ${variantId ?? factionId}.`
		);
	}
}

const toFighter = (r: repo.FighterRow): Fighter => ({
	id: r.id,
	unitId: r.unitId,
	...(r.name ? { name: r.name } : {}),
	group: r.grp,
	kit: r.kit,
	upgrades: r.upgrades,
	skills: r.skills,
	injuries: r.injuries,
	xp: r.xp
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
	const { set, f } = await resolveFor(w, w.factionId, w.variantId);
	return {
		w,
		rows,
		seat,
		set,
		f,
		opts: optionsFor(seat),
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

// ---------------------------------------------------------------- shapes

const seatOut = (s: repo.SeatOf | null) =>
	s
		? {
				campaignId: s.campaignId,
				campaignName: s.campaignName,
				seatId: s.seatId,
				allowBeyondLimits: s.allowBeyondLimits
			}
		: null;

/** A list card; a warband whose rules are no longer loaded still lists, by its ids. */
export function cardOf(
	w: repo.WarbandRow,
	l: Pick<Loaded, 'f' | 'state' | 'opts'> | null,
	seat: repo.SeatOf | null
): ApiWarbandCard {
	const r = l ? rating(l.state, l.f, l.opts) : { ducats: 0, glory: 0 };
	return {
		id: w.id,
		name: w.name,
		rulesSet: w.rulesSet,
		rulesExpansions: w.rulesExpansions,
		factionId: w.factionId,
		factionName: l?.f.faction.name ?? w.factionId,
		variantName: l?.f.variant?.name ?? null,
		rating: r,
		ducatLimit: w.ducatLimit,
		fighters: l ? l.state.fighters.filter((x) => x.group !== 'dead').length : 0,
		problems: l ? issuesOf(l.state, l.f, l.opts).filter((i) => i.severity === 'error').length : 0,
		seat: seatOut(seat)
	};
}

function fighterOut(
	l: Loaded,
	r: repo.FighterRow,
	cost: { ducats: number; glory: number }
): ApiFighter {
	const { f } = l;
	const unit = f.idx.units.get(r.unitId);
	const item = (itemId: string, lineId: string | null, fixed: boolean) => ({
		lineId,
		itemId,
		name: nameOf(f, itemId),
		fixed
	});
	return {
		id: r.id,
		unitId: r.unitId,
		unitName: unit?.name ?? r.unitId,
		name: r.name,
		group: r.grp,
		cost,
		kit: [
			...(unit?.kit.fixed ?? []).map((i) => item(i, null, true)),
			...r.kit.map((l) => item(f.idx.lines.get(l)?.item ?? l, l, false))
		],
		upgrades: r.upgrades.map((u) => ({ id: u, name: nameOf(f, u) })),
		skills: r.skills.map((s) => ({ ref: s, name: refName(f, s) })),
		injuries: r.injuries.map((s) => ({ ref: s, name: refName(f, s) })),
		xp: r.xp,
		image: r.image ? `/uploads/fighters/${r.id}?v=${r.version}` : null,
		version: r.version
	};
}

/** The whole warband as the builder and the API show it: costs, rating, problems, seat. */
export async function viewOf(tx: Tx, l: Loaded): Promise<ApiWarband> {
	const costs = fighterCosts(l.state, l.f, l.opts);
	// The dead are off the table, so off the rating; their own cost is still shown.
	const costOf = (r: repo.FighterRow) =>
		costs.get(r.id) ??
		fighterCosts({ ...l.state, fighters: [{ ...toFighter(r), group: 'troop' }] }, l.f, l.opts).get(
			r.id
		) ?? { ducats: 0, glory: 0 };
	const card = cardOf(l.w, l, l.seat);
	return {
		...card,
		ownerId: l.w.ownerId,
		ownerName: await repo.ownerName(tx, l.w.ownerId),
		variantId: l.w.variantId,
		patronId: l.w.patronId,
		patronName: l.w.patronId ? nameOf(l.f, l.w.patronId) : null,
		dedication: l.w.dedication,
		stashDucats: l.w.stashDucats,
		unspentGlory: l.w.unspentGlory,
		stash: l.w.stash.map((id) => {
			const itemId = l.f.idx.lines.get(id)?.item ?? id;
			return { lineId: id, itemId, name: nameOf(l.f, itemId) };
		}),
		fireteams: l.w.fireteams,
		locations: l.w.locations,
		notes: l.w.notes,
		fighters: l.rows.map((r) => fighterOut(l, r, costOf(r))),
		fireteamsMax: l.f.rules.fireteams ?? 0,
		issues: issuesOf(l.state, l.f, l.opts),
		canEdit: l.canEdit,
		version: l.w.version
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
