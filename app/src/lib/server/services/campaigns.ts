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
import * as warbandsRepo from '../repos/warbands';
import { record, type Ctx, type SessionUser } from './audit';
import { openLink } from './link-cipher';
import { requireUser } from './auth';
import { hbSetId, isHomebrewSet } from '#lib/rules/homebrew';
import { checkHomebrewPick, checkRulesPick, homebrewClosure, labeller, mayUse } from './rules';

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
		rulesSet: r.c.rulesSet,
		rulesExpansions: r.c.rulesExpansions,
		rules: (await labeller())(r.c.rulesSet, r.c.rulesExpansions),
		allowBeyondLimits: r.c.allowBeyondLimits,
		homebrewSets: r.c.homebrewSets,
		members: await campaignsRepo.listMembers(tx, id),
		version: r.c.version
	};
}

function linkOf(l: NonNullable<seatsRepo.SeatView['link']>): NonNullable<ApiSeat['link']> {
	const token = openLink(l.tokenEnc);
	return {
		state: token ? 'ready' : 'old',
		tail: token ? token.slice(-4) : null,
		createdAt: l.createdAt.toISOString(),
		openedAt: iso(l.openedAt)
	};
}

/**
 * A seat as the API shows it; people outside the campaign see neither the player nor a renamed seat's name, and
 * only the CM and co-CMs see the seat's link.
 */
export function toSeat(v: seatsRepo.SeatView, showPlayers: boolean, showLink = false): ApiSeat {
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
		link: showLink && v.link ? linkOf(v.link) : null,
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
 * it gets `not_found`, so private campaigns do not leak; Owners see every campaign, so they can hand over the CM
 * role of any of them (decision 7). Deleted ones are visible only with `deleted` to their CM and to Owners, within
 * the restore window. Seeing is not acting: rights are still checked with `need`.
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
	} else if (!role && !seated && c.visibility !== 'listed' && me.role !== 'owner') throw notFound();
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
			// A Carcass Front campaign reads the core rules plus the Carcass Front expansion folder.
			rulesExpansions: input.kind === 'carcass_front' ? ['carcass-front-1.0'] : [],
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

/**
 * A campaign keeps one rules version for every warband in it: changing the version (or the expansions on it) is
 * refused while a seated warband is built for other rules, naming them, so nobody plays a list nobody checked.
 */
async function noSeatedWarbandsOff(tx: Tx, id: string, rulesSet: string, expansions: string[]) {
	// Homebrew on top is the warband's own choice (the allow-list governs it), not the campaign's rules.
	const key = (set: string, exp: string[]) =>
		[set, ...exp.filter((e) => !isHomebrewSet(e)).sort()].join('+');
	const off = (await warbandsRepo.rulesInCampaign(tx, id)).filter(
		(w) => key(w.rulesSet, w.rulesExpansions) !== key(rulesSet, expansions)
	);
	if (!off.length) return;
	const message = `${off.map((w) => w.name).join(', ')} ${off.length === 1 ? 'is' : 'are'} built for other rules. Take ${off.length === 1 ? 'it' : 'them'} out of the seats (or move ${off.length === 1 ? 'it' : 'them'} to ${rulesSet}) first.`;
	throw new AppError('conflict', message, { rulesSet: message });
}

/**
 * The homebrew a campaign allows: sets newly ticked must be ones the person can see and must pass their checks;
 * every allowed set must build only on the campaign's rules (checked again when the version changes); and a set
 * a seated warband is built on stays allowed until that warband leaves its seat.
 */
async function checkHomebrewChoice(
	tx: Tx,
	ctx: Ctx,
	c: campaignsRepo.CampaignRow,
	next: string[],
	rulesSet: string
) {
	const added = next.filter((x) => !c.homebrewSets.includes(x));
	try {
		await mayUse(ctx, added.map(hbSetId));
	} catch {
		throw new AppError('invalid', 'Pick homebrew sets you can see.', {
			homebrewSets: 'Pick homebrew sets you can see.'
		});
	}
	await checkHomebrewPick(rulesSet, c.rulesExpansions, rulesSet === c.rulesSet ? added : next);
	const keep = await homebrewClosure(next);
	const off = (await warbandsRepo.rulesInCampaign(tx, c.id)).filter((w) =>
		w.rulesExpansions.some((e) => isHomebrewSet(e) && !keep.has(e))
	);
	if (off.length) {
		const message = `${off.map((w) => w.name).join(', ')} ${off.length === 1 ? 'is' : 'are'} built on homebrew this would no longer allow. Take ${off.length === 1 ? 'it' : 'them'} out of the seats first.`;
		throw new AppError('conflict', message, { homebrewSets: message });
	}
}

/** Change the settings; `version` must match, so two people never overwrite each other. */
export async function update(ctx: Ctx, id: string, input: CampaignPatch): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'edit');
		notEnded(a);
		if (a.c.version !== input.version) throw stale();
		if (await campaignsRepo.nameTaken(tx, input.name, id)) throw nameTaken();
		if (input.rulesSet && input.rulesSet !== a.c.rulesSet) {
			await checkRulesPick(input.rulesSet, a.c.rulesExpansions);
			await noSeatedWarbandsOff(tx, id, input.rulesSet, a.c.rulesExpansions);
		}
		const homebrew = input.homebrewSets ? [...new Set(input.homebrewSets)] : a.c.homebrewSets;
		if (input.homebrewSets || (input.rulesSet && input.rulesSet !== a.c.rulesSet))
			await checkHomebrewChoice(tx, ctx, a.c, homebrew, input.rulesSet ?? a.c.rulesSet);
		await campaignsRepo.update(
			tx,
			id,
			{
				...(input.rulesSet ? { rulesSet: input.rulesSet } : {}),
				...(input.allowBeyondLimits !== undefined
					? { allowBeyondLimits: input.allowBeyondLimits }
					: {}),
				...(input.homebrewSets ? { homebrewSets: homebrew } : {}),
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

/**
 * Hand the CM role to a co-CM; the old CM stays on as a co-CM. The CM, or an Owner for a CM who is gone; an Owner
 * may also take the role themselves without being a co-CM first.
 */
export async function transfer(ctx: Ctx, id: string, userId: string): Promise<ApiCampaign> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, id, { lock: true });
		need(a, 'transfer');
		const target = await campaignsRepo.roleOf(tx, id, userId);
		if (target === 'cm') throw new AppError('conflict', 'They are the CM already.');
		const ownerTakes = a.me.role === 'owner' && userId === a.me.id;
		if (target !== 'co_cm' && !ownerTakes)
			throw new AppError('conflict', 'Hand the CM role to a co-CM. Add them as a co-CM first.');
		await rightsHolder(tx, userId);
		const old = (await campaignsRepo.listMembers(tx, id)).find((m) => m.role === 'cm');
		// The old CM steps down first: the partial unique index allows only one CM at any moment.
		if (old) await campaignsRepo.setMemberRole(tx, id, old.userId, 'co_cm');
		if (target) await campaignsRepo.setMemberRole(tx, id, userId, 'cm');
		else await campaignsRepo.insertMember(tx, { campaignId: id, userId, role: 'cm' });
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
