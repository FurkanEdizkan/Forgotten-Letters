/**
 * Seats: the places players hold. The CM and co-CMs add, rename, free and remove seats, make one-time seat links
 * (7 days; a new link revokes the seat's open one) and add people by name; players take a seat by link and may
 * leave it while the campaign musters. Taking a seat by link copies the invite flow: rate limit and password check
 * before the transaction, then the campaign and the link are locked so one link fills one seat exactly once.
 */
import type { ApiSeat, ApiSeatInvitePreview, ApiSeatLink } from '#lib/api-types';
import { joinOpen } from '#lib/campaign-stage';
import { canInCampaign } from '#lib/campaign-rights';
import type { NewAccountInput } from '#lib/schemas/auth';
import { SEATS_MAX, SEATS_MIN } from '#lib/schemas/campaigns';
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import { config } from '../infra/config';
import * as campaignsRepo from '../repos/campaigns';
import * as requestsRepo from '../repos/join-requests';
import * as seatsRepo from '../repos/seats';
import * as usersRepo from '../repos/users';
import { record, type Ctx, type SessionUser } from './audit';
import {
	checkPassword,
	createSession,
	limitJoin,
	requireUser,
	toSessionUser,
	type NewSession
} from './auth';
import { access, need, notEnded, toSeat } from './campaigns';
import { hashPassword, newToken, tokenHash } from './passwords';
import { openLink, sealLink } from './link-cipher';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** The link for a token; relative when no ORIGIN is set (the page adds its own address). */
export const seatLink = (token: string) =>
	`${(config().ORIGIN ?? '').replace(/\/$/, '')}/join/${token}`;

export const taken = () => new AppError('conflict', 'That seat is taken.');
export const holdsSeat = (self: boolean) =>
	new AppError(
		'conflict',
		self
			? 'You already hold a seat in this campaign.'
			: 'That person already holds a seat in this campaign.'
	);
const noSeat = () => new AppError('not_found', 'No such seat.');
const linksClosed = () =>
	new AppError('conflict', 'Seat links work only while the campaign is mustering.');
const stale = () =>
	new AppError('conflict', 'Someone changed this seat meanwhile. Reload and try again.');

// Only seat changes by the CM or a co-CM return a single seat, so it carries the link.
const view = async (tx: Tx, id: string) => toSeat(await seatsRepo.view(tx, id), true, true);

/**
 * Put a person in an empty seat; a seat still called "Seat N" takes the player's name. Revokes the seat's open link
 * and closes the person's open request to join (approving marks it approved afterwards).
 */
export async function fill(
	tx: Tx,
	seat: seatsRepo.SeatRow,
	user: { id: string; displayName: string }
) {
	await seatsRepo.update(tx, seat.id, {
		userId: user.id,
		joinedAt: new Date(),
		...(seat.name === seatsRepo.defaultName(seat.number)
			? { name: user.displayName.slice(0, 40) }
			: {})
	});
	await seatsRepo.revokeOpen(tx, seat.id);
	await requestsRepo.closeOpenFor(tx, seat.campaignId, user.id);
}

/** Empty a seat; a seat named after the leaving player gets its default name back. */
async function empty(tx: Tx, seat: seatsRepo.SeatRow, name?: string, version?: number) {
	const player = seat.userId ? await usersRepo.findById(tx, seat.userId) : null;
	return seatsRepo.update(
		tx,
		seat.id,
		{
			userId: null,
			joinedAt: null,
			name:
				name ??
				(player && seat.name === player.displayName.slice(0, 40)
					? seatsRepo.defaultName(seat.number)
					: seat.name)
		},
		version
	);
}

/** The seats: members see the players, people outside a listed campaign see only which seats are taken. */
export async function list(ctx: Ctx, campaignId: string): Promise<ApiSeat[]> {
	const a = await access(db(), ctx, campaignId);
	const show = !!a.role || a.seated;
	const links = canInCampaign(a.role, a.me.role, 'seats');
	return (await seatsRepo.list(db(), campaignId)).map((v) => toSeat(v, show, links));
}

/** Add seats; the campaign has 30 at most. Returns the new seats. */
export async function add(ctx: Ctx, campaignId: string, count: number): Promise<ApiSeat[]> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		notEnded(a);
		const now = await seatsRepo.count(tx, campaignId);
		if (now.total + count > SEATS_MAX)
			throw new AppError('conflict', `A campaign has ${SEATS_MAX} seats at most.`);
		const rows = await seatsRepo.insertMany(tx, campaignId, now.max + 1, count);
		await record(tx, ctx, 'seat.added', { type: 'campaign', id: campaignId }, { count });
		return rows.map((seat) => toSeat({ seat, playerName: null, link: null }, true, true));
	});
}

/** Rename a seat and/or free it (the player leaves the seat); `version` must match. */
export async function update(
	ctx: Ctx,
	campaignId: string,
	seatId: string,
	input: { version: number; name?: string; free?: boolean }
): Promise<ApiSeat> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		notEnded(a);
		const s = await seatsRepo.lock(tx, campaignId, seatId);
		if (!s) throw noSeat();
		if (s.version !== input.version) throw stale();
		const freeing = input.free === true && !!s.userId;
		const next = freeing
			? await empty(tx, s, input.name, input.version)
			: await seatsRepo.update(tx, s.id, { name: input.name ?? s.name }, input.version);
		if (!next) throw stale();
		const target = { type: 'seat', id: s.id };
		if (input.name !== undefined && input.name !== s.name)
			await record(tx, ctx, 'seat.renamed', target, { from: s.name, to: input.name });
		if (freeing) await record(tx, ctx, 'seat.freed', target, { userId: s.userId });
		return view(tx, s.id);
	});
}

/** Remove an empty seat; a campaign keeps at least 2. */
export async function remove(ctx: Ctx, campaignId: string, seatId: string): Promise<void> {
	await db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		notEnded(a);
		const s = await seatsRepo.lock(tx, campaignId, seatId);
		if (!s) throw noSeat();
		if (s.userId) throw taken();
		if ((await seatsRepo.count(tx, campaignId)).total <= SEATS_MIN)
			throw new AppError('conflict', `A campaign keeps at least ${SEATS_MIN} seats.`);
		await seatsRepo.removeEmpty(tx, s.id);
		await record(tx, ctx, 'seat.removed', { type: 'seat', id: s.id }, { name: s.name });
	});
}

async function issue(
	tx: Tx,
	ctx: Ctx,
	me: SessionUser,
	s: seatsRepo.SeatRow
): Promise<ApiSeatLink> {
	await seatsRepo.revokeOpen(tx, s.id);
	const token = newToken();
	const i = await seatsRepo.insertInvite(tx, {
		seatId: s.id,
		tokenHash: tokenHash(token),
		tokenEnc: sealLink(token),
		createdBy: me.id
	});
	await record(tx, ctx, 'seat.link_made', { type: 'seat', id: s.id });
	return {
		seatId: s.id,
		seatName: s.name,
		url: seatLink(token),
		expiresAt: iso(i.expiresAt)
	};
}

const oldLink = () =>
	new AppError('conflict', 'This link was made before links could be copied. Make a new one.');

/** The seat's open link again, to copy; recorded in the audit log. */
export async function copyLink(
	ctx: Ctx,
	campaignId: string,
	seatId: string
): Promise<ApiSeatLink & { createdAt: string }> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId);
		need(a, 'seats');
		const v = (await seatsRepo.list(tx, campaignId)).find((x) => x.seat.id === seatId);
		if (!v) throw noSeat();
		if (!v.link) throw new AppError('not_found', 'This seat has no open link. Make one first.');
		const token = openLink(v.link.tokenEnc);
		if (!token) throw oldLink();
		await record(tx, ctx, 'seat.link_copied', { type: 'seat', id: seatId });
		return {
			seatId,
			seatName: v.seat.name,
			url: seatLink(token),
			expiresAt: null,
			createdAt: v.link.createdAt.toISOString()
		};
	});
}

/** Withdraw every open seat link of the campaign at once; returns how many stopped working. */
export async function revokeAllLinks(ctx: Ctx, campaignId: string): Promise<number> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		const n = await seatsRepo.revokeAllOpen(tx, campaignId);
		if (n)
			await record(
				tx,
				ctx,
				'seat.link_revoked',
				{ type: 'campaign', id: campaignId },
				{ count: n }
			);
		return n;
	});
}

/** A lasting link for an empty seat (until someone takes it or it is withdrawn); the seat's old link stops working. Mustering only. */
export async function makeLink(ctx: Ctx, campaignId: string, seatId: string): Promise<ApiSeatLink> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		if (!joinOpen(a.c.stage, 'link')) throw linksClosed();
		const s = await seatsRepo.lock(tx, campaignId, seatId);
		if (!s) throw noSeat();
		if (s.userId) throw taken();
		return issue(tx, ctx, a.me, s);
	});
}

/** A fresh link for every empty seat; their old links stop working. Mustering only. */
export async function makeAllLinks(ctx: Ctx, campaignId: string): Promise<ApiSeatLink[]> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		if (!joinOpen(a.c.stage, 'link')) throw linksClosed();
		const links: ApiSeatLink[] = [];
		for (const s of await seatsRepo.emptySeats(tx, campaignId))
			links.push(await issue(tx, ctx, a.me, s));
		return links;
	});
}

/** Withdraw a seat's open link. */
export async function revokeLink(ctx: Ctx, campaignId: string, seatId: string): Promise<void> {
	await db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		const s = await seatsRepo.lock(tx, campaignId, seatId);
		if (!s) throw noSeat();
		if (await seatsRepo.revokeOpen(tx, s.id))
			await record(tx, ctx, 'seat.link_revoked', { type: 'seat', id: s.id });
	});
}

/** Add a person by name to an empty seat; until the campaign ends. */
export async function assign(
	ctx: Ctx,
	campaignId: string,
	seatId: string,
	userId: string
): Promise<ApiSeat> {
	return db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		need(a, 'seats');
		notEnded(a);
		const s = await seatsRepo.lock(tx, campaignId, seatId);
		if (!s) throw noSeat();
		if (s.userId) throw taken();
		const u = await usersRepo.findById(tx, userId);
		if (!u || u.disabledAt || u.anonymisedAt) throw new AppError('not_found', 'No such account.');
		if (await seatsRepo.seatOf(tx, campaignId, u.id)) throw holdsSeat(false);
		await fill(tx, s, u);
		await record(tx, ctx, 'seat.assigned', { type: 'seat', id: s.id }, { userId: u.id });
		return view(tx, s.id);
	});
}

/** Leave one's own seat; mustering only. */
export async function leave(ctx: Ctx, campaignId: string): Promise<void> {
	await db().transaction(async (tx) => {
		const a = await access(tx, ctx, campaignId, { lock: true });
		const s = await seatsRepo.seatOf(tx, campaignId, a.me.id);
		if (!s) throw new AppError('not_found', 'You do not hold a seat in this campaign.');
		if (!joinOpen(a.c.stage, 'leave'))
			throw new AppError(
				'conflict',
				'You can leave your seat only while the campaign is mustering.'
			);
		await empty(tx, s);
		await record(tx, ctx, 'seat.left', { type: 'seat', id: s.id });
	});
}

/** Who could be added by name: active accounts without a seat here, up to 10. */
export async function candidates(ctx: Ctx, campaignId: string, q: string) {
	const a = await access(db(), ctx, campaignId);
	need(a, 'seats');
	return seatsRepo.candidates(db(), campaignId, q);
}

/** What a seat link page shows before someone takes the seat. */
export async function preview(token: string): Promise<ApiSeatInvitePreview | { state: 'unknown' }> {
	const i = await seatsRepo.findInviteByToken(db(), tokenHash(token));
	const s = i && (await seatsRepo.findById(db(), i.seatId));
	const c = s && (await campaignsRepo.findById(db(), s.campaignId));
	if (!i || !s || !c) return { state: 'unknown' };
	const cm = (await campaignsRepo.listMembers(db(), c.id)).find((m) => m.role === 'cm');
	if (!i.openedAt) await seatsRepo.markInviteOpened(db(), i.id);
	const state = i.usedAt
		? ('used' as const)
		: i.revokedAt || c.deletedAt
			? ('revoked' as const)
			: i.expiresAt && i.expiresAt <= new Date()
				? ('expired' as const)
				: ('open' as const);
	return {
		state,
		campaign: {
			id: c.id,
			name: c.name,
			kind: c.kind,
			stage: c.stage,
			cmName: cm?.displayName ?? ''
		},
		seatName: s.name,
		expiresAt: iso(i.expiresAt)
	};
}

const gone = () => new AppError('not_found', 'This seat link does not exist or was withdrawn.');

/**
 * Take the seat a link offers. Signed in: `{}` takes it with the current account. A visitor sends a new account,
 * which is created (as a User) and signed in; the session is returned to set as the cookie.
 */
export async function accept(
	token: string,
	input: NewAccountInput | Record<string, never>,
	ctx: Ctx
): Promise<{ campaignId: string; session: NewSession | null; user: SessionUser | null }> {
	limitJoin(ctx);
	const account = !ctx.actor && 'username' in input ? (input as NewAccountInput) : null;
	if (!ctx.actor && !account)
		throw new AppError('unauthenticated', 'Sign in or make an account to take the seat.');
	if (account) checkPassword(account.password);
	const passwordHash = account ? await hashPassword(account.password) : '';
	const hash = tokenHash(token);
	return db().transaction(async (tx) => {
		// Lock the campaign before the link, the same order as every other seat change, so they never deadlock.
		const found = await seatsRepo.findInviteByToken(tx, hash);
		const seat = found && (await seatsRepo.findById(tx, found.seatId));
		const c = seat && (await campaignsRepo.lock(tx, seat.campaignId));
		const i = c && (await seatsRepo.lockInviteByToken(tx, hash));
		if (!i || !c || i.revokedAt || c.deletedAt) throw gone();
		if (i.usedAt)
			throw new AppError(
				'conflict',
				'This seat link was already used. Ask the Campaign Master for a new one.'
			);
		if (i.expiresAt && i.expiresAt <= new Date())
			throw new AppError(
				'not_found',
				'This seat link has expired. Ask the Campaign Master for a new one.'
			);
		if (!joinOpen(c.stage, 'link')) throw linksClosed();
		const s = await seatsRepo.lock(tx, c.id, i.seatId);
		if (!s) throw gone();
		if (s.userId) throw taken();
		let user: usersRepo.UserRow | null;
		if (account) {
			user = await usersRepo.insert(tx, {
				username: account.username,
				displayName: account.displayName,
				passwordHash,
				role: 'user',
				invitedBy: i.createdBy
			});
			if (!user)
				throw new AppError('invalid', 'Check the highlighted fields.', {
					username: 'That username is taken.'
				});
		} else {
			user = (await usersRepo.findById(tx, requireUser(ctx).id))!;
			if (await seatsRepo.seatOf(tx, c.id, user.id)) throw holdsSeat(true);
		}
		// Used before the seat is filled, so filling (which revokes the seat's open links) leaves this one "used".
		await seatsRepo.markInviteUsed(tx, i.id, user.id);
		await fill(tx, s, user);
		const session = account ? await createSession(tx, user.id, false, ctx) : null;
		const actor = session ? toSessionUser(user, tokenHash(session.token)) : ctx.actor;
		await record(
			tx,
			{ ...ctx, actor },
			'seat.joined',
			{ type: 'seat', id: s.id },
			{ campaignId: c.id, way: 'link', newAccount: !!account }
		);
		return { campaignId: c.id, session, user: session ? actor : null };
	});
}
