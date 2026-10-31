/**
 * Campaigns: create, list, read, change settings, move between stages, soft delete and restore, and the CM's team
 * (co-CMs, handing over the CM role). Rights come from `campaign-rights`, stage moves from `campaign-stage`. Every
 * change locks the campaign row first and is audited in the same transaction.
 */
import type { ApiCampaign, ApiCampaignCard, ApiSeat } from '#lib/api-types';
import {
	canInCampaign,
	canRunCampaigns,
	type CampaignAction,
	type CampaignRole
} from '#lib/campaign-rights';
import { canMove, type Stage } from '#lib/campaign-stage';
import type { CampaignCreate, CampaignPatch } from '#lib/schemas/campaigns';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as campaignsRepo from '../repos/campaigns';
import * as seatsRepo from '../repos/seats';
import * as usersRepo from '../repos/users';
import { record, type Ctx, type SessionUser } from './audit';
import { requireUser } from './auth';

const DAY = 24 * 60 * 60 * 1000;
/** A deleted campaign can be restored for this long; then the daily purge removes it. */
export const KEEP_DELETED_DAYS = 30;
export const deletedSince = () => new Date(Date.now() - KEEP_DELETED_DAYS * DAY);

const iso = (d: Date | null) => d?.toISOString() ?? null;

export const nameTaken = () =>
	new AppError('conflict', 'That name is taken by another campaign. Try another.', {
		name: 'That name is taken by another campaign. Try another.'
	});
const stale = () =>
	new AppError(
		'conflict',
		'Someone else saved these settings a moment ago. Reload to see their changes, then save again.'
	);
export const ended = () =>
	new AppError('conflict', 'This campaign has ended. It is read-only now.');
const notFound = () => new AppError('not_found', 'No such campaign.');

// ---------------------------------------------------------------- shapes

export function toCard(r: campaignsRepo.CardRow): ApiCampaignCard {
	const c = r.c;
	return {
		id: c.id,
		name: c.name,
		kind: c.kind,
		stage: c.stage,
		visibility: c.visibility,
		seatsTaken: r.seatsTaken,
		seatsTotal: r.seatsTotal,
		startsOn: c.startsOn,
		endsOn: c.endsOn,
		gamesPerPlayer: c.gamesPerPlayer,
		cmName: r.cmName,
		myRole: r.myRole,
		mySeat: r.mySeat,
		myOpenRequest: r.myOpenRequest,
		deletedAt: iso(c.deletedAt)
	};
}

async function full(tx: Tx, id: string, userId: string): Promise<ApiCampaign> {
	const r = (await campaignsRepo.card(tx, id, userId))!;
	return {
		...toCard(r),
		description: r.c.description,
		houseRules: r.c.houseRules,
		members: await campaignsRepo.listMembers(tx, id),
		version: r.c.version
	};
}

/** A seat as the API shows it; people outside the campaign see neither the player nor a renamed seat's name. */
export function toSeat(v: seatsRepo.SeatView, showPlayers: boolean): ApiSeat {
	const s = v.seat;
	return {
		id: s.id,
		number: s.number,
		name: showPlayers ? s.name : seatsRepo.defaultName(s.number),
		player:
			showPlayers && s.userId
				? { id: s.userId, displayName: v.playerName ?? 'Former member' }
				: null,
		joinedAt: iso(s.joinedAt),
		hasOpenLink: showPlayers && v.hasOpenLink,
		version: s.version
	};
}

// ---------------------------------------------------------------- access

export interface Access {
	c: campaignsRepo.CampaignRow;
	role: CampaignRole | null;
	seated: boolean;
	me: SessionUser;
}

/**
 * Load a campaign for the caller (locked with `lock`, for changes). Someone with no rights, no seat and no way to see
 * it gets `not_found`, so private campaigns do not leak; deleted ones are visible only with `deleted` to their CM
 * and to Owners, within the restore window.
 */
export async function access(
	tx: Tx,
	ctx: Ctx,
	id: string,
	opts: { lock?: boolean; deleted?: boolean } = {}
): Promise<Access> {
	const me = requireUser(ctx);
	const c = await (opts.lock ? campaignsRepo.lock(tx, id) : campaignsRepo.findById(tx, id));
	if (!c) throw notFound();
	const role = await campaignsRepo.roleOf(tx, id, me.id);
	const seated = !!(await seatsRepo.seatOf(tx, id, me.id));
	if (c.deletedAt) {
		if (
			!opts.deleted ||
			c.deletedAt <= deletedSince() ||
			!canInCampaign(role, me.role, 'see_deleted')
		)
			throw notFound();
	} else if (!role && !seated && c.visibility !== 'listed') throw notFound();
	return { c, role, seated, me };
}

const CM_ONLY: CampaignAction[] = ['delete', 'restore', 'see_deleted', 'co_cms', 'transfer'];

/** Refuse unless the caller has this right in the campaign. */
export function need(a: Access, action: CampaignAction) {
	if (!canInCampaign(a.role, a.me.role, action))
		throw new AppError(
			'forbidden',
			CM_ONLY.includes(action)
				? 'Only the Campaign Master can do that.'
				: 'Only the Campaign Master or a co-CM can do that.'
		);
}

export function notEnded(a: Access) {
	if (a.c.stage === 'ended') throw ended();
}

// ---------------------------------------------------------------- campaigns

/** A page of campaign cards: mine, listed (to ask to join) or deleted (to restore). */
export async function list(
	ctx: Ctx,
	q: { scope: campaignsRepo.Scope; after?: string; limit: number }
): Promise<{ items: ApiCampaignCard[]; next: string | null }> {
	const me = requireUser(ctx);
	const rows = await campaignsRepo.cards(db(), {
		...q,
		userId: me.id,
		owner: me.role === 'owner',
		deletedSince: deletedSince()
	});
	return { items: rows.map(toCard), next: rows.length === q.limit ? rows.at(-1)!.c.id : null };
}

/** Create a campaign with its seats; the creator becomes its CM. One transaction: all of it or nothing. */
export async function create(
	ctx: Ctx,
	input: CampaignCreate
): Promise<{ campaign: ApiCampaign; seats: ApiSeat[] }> {
	const me = requireUser(ctx);
	if (!canRunCampaigns(me.role))
		throw new AppError('forbidden', 'Only Owners and Admins create campaigns.');
	return db().transaction(async (tx) => {
		const c = await campaignsRepo.insert(tx, {
			name: input.name,
			kind: input.kind,
			description: input.description,
			visibility: input.visibility,
			gamesPerPlayer: input.gamesPerPlayer ?? null,
			startsOn: input.startsOn ?? null,
			endsOn: input.endsOn ?? null,
			houseRules: input.houseRules,
			createdBy: me.id
		});
		if (!c) throw nameTaken();
		await campaignsRepo.insertMember(tx, { campaignId: c.id, userId: me.id, role: 'cm' });
		await seatsRepo.insertMany(tx, c.id, 1, input.seats);
		await record(
			tx,
			ctx,
			'campaign.created',
			{ type: 'campaign', id: c.id },
			{ name: c.name, kind: c.kind, seats: input.seats }
		);
		const seats = (await seatsRepo.list(tx, c.id)).map((v) => toSeat(v, true));
		return { campaign: await full(tx, c.id, me.id), seats };
	});
}

/** One campaign, for anyone who may see it (its CM and Owners also while it is deleted). */
export async function get(ctx: Ctx, id: string): Promise<ApiCampaign> {
	const a = await access(db(), ctx, id, { deleted: true });
	return full(db(), id, a.me.id);
}

/** Change the settings; `version` must match, so two people never overwrite each other. */
export async function update(ctx: Ctx, id: string, input: CampaignPatch): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'edit');
		notEnded(a);
		if (a.c.version !== input.version) throw stale();
		if (await campaignsRepo.nameTaken(tx, input.name, id)) throw nameTaken();
		await campaignsRepo.update(
			tx,
			id,
			{
				name: input.name,
				description: input.description,
				visibility: input.visibility,
				gamesPerPlayer: input.gamesPerPlayer ?? null,
				startsOn: input.startsOn ?? null,
				endsOn: input.endsOn ?? null,
				...(input.houseRules ? { houseRules: input.houseRules } : {})
			},
			input.version
		);
		await record(tx, ctx, 'campaign.updated', { type: 'campaign', id });
		return full(tx, id, a.me.id);
	});
}

/** Soft delete: hidden at once, restorable for 30 days, then purged. */
export async function remove(ctx: Ctx, id: string): Promise<void> {
	await db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'delete');
		await campaignsRepo.update(tx, id, { deletedAt: new Date() });
		await record(tx, ctx, 'campaign.deleted', { type: 'campaign', id }, { name: a.c.name });
	});
}

/** Undo a delete within 30 days, if nobody has taken the name meanwhile. */
export async function restore(ctx: Ctx, id: string): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true, deleted: true });
		need(a, 'restore');
		if (!a.c.deletedAt) throw new AppError('conflict', 'This campaign is not deleted.');
		if (await campaignsRepo.nameTaken(tx, a.c.name, id)) throw nameTaken();
		await campaignsRepo.update(tx, id, { deletedAt: null });
		await record(tx, ctx, 'campaign.restored', { type: 'campaign', id }, { name: a.c.name });
		return full(tx, id, a.me.id);
	});
}

/** Move along the stage machine (mustering ↔ active, active → ended). */
export async function moveStage(ctx: Ctx, id: string, to: Stage): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'stage');
		if (!canMove(a.c.stage, to))
			throw new AppError('conflict', `A campaign cannot move from ${a.c.stage} to ${to}.`);
		await campaignsRepo.update(tx, id, { stage: to });
		await record(
			tx,
			ctx,
			'campaign.stage_changed',
			{ type: 'campaign', id },
			{ from: a.c.stage, to }
		);
		return full(tx, id, a.me.id);
	});
}

// ---------------------------------------------------------------- the CM's team

async function rightsHolder(tx: Tx, userId: string) {
	const u = await usersRepo.findById(tx, userId);
	if (!u) throw new AppError('not_found', 'No such account.');
	// ponytail: the account row is not locked, so a demotion racing this add can leave a User as co-CM until the
	// next role change; lock the user row here if that ever matters.
	if (u.disabledAt || u.role === 'user')
		throw new AppError('conflict', 'Only an active Admin or Owner can be a co-CM.');
	return u;
}

/** Give an active Admin or Owner co-CM rights. CM only. */
export async function addCoCm(ctx: Ctx, id: string, userId: string): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'co_cms');
		await rightsHolder(tx, userId);
		if (await campaignsRepo.roleOf(tx, id, userId))
			throw new AppError('conflict', 'They already have rights in this campaign.');
		await campaignsRepo.insertMember(tx, { campaignId: id, userId, role: 'co_cm' });
		await record(tx, ctx, 'campaign.co_cm_added', { type: 'campaign', id }, { userId });
		return full(tx, id, a.me.id);
	});
}

/** Take co-CM rights away. CM only. */
export async function removeCoCm(ctx: Ctx, id: string, userId: string): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'co_cms');
		if ((await campaignsRepo.roleOf(tx, id, userId)) !== 'co_cm')
			throw new AppError('not_found', 'They are not a co-CM here.');
		await campaignsRepo.removeMember(tx, id, userId);
		await record(tx, ctx, 'campaign.co_cm_removed', { type: 'campaign', id }, { userId });
		return full(tx, id, a.me.id);
	});
}

/** Hand the CM role to a co-CM; the old CM stays on as a co-CM. The CM, or an Owner for a CM who is gone. */
export async function transfer(ctx: Ctx, id: string, userId: string): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'transfer');
		if ((await campaignsRepo.roleOf(tx, id, userId)) !== 'co_cm')
			throw new AppError('conflict', 'Hand the CM role to a co-CM. Add them as a co-CM first.');
		await rightsHolder(tx, userId);
		const old = (await campaignsRepo.listMembers(tx, id)).find((m) => m.role === 'cm');
		// The old CM steps down first: the partial unique index allows only one CM at any moment.
		if (old) await campaignsRepo.setMemberRole(tx, id, old.userId, 'co_cm');
		await campaignsRepo.setMemberRole(tx, id, userId, 'cm');
		await record(
			tx,
			ctx,
			'campaign.cm_transferred',
			{ type: 'campaign', id },
			{ from: old?.userId ?? null, to: userId }
		);
		return full(tx, id, a.me.id);
	});
}

/** Who could become a co-CM: active Admins and Owners without rights here, up to 10. CM only. */
export async function coCmCandidates(ctx: Ctx, id: string, q: string) {
	const a = await access(db(), ctx, id);
	need(a, 'co_cms');
	return campaignsRepo.coCmCandidates(db(), id, q);
}

/**
 * The CM and co-CM rights one person holds in campaigns not deleted or still restorable (for the demotion rule in
 * people: a restorable campaign would come back with them as CM).
 */
export const rolesOf = (tx: Tx, userId: string) =>
	campaignsRepo.rightsOf(tx, userId, deletedSince());

/** Drop a person's co-CM rows (their site role no longer allows them). */
export const dropCoCmRights = (tx: Tx, userId: string) =>
	campaignsRepo.removeCoCmRowsOf(tx, userId);
