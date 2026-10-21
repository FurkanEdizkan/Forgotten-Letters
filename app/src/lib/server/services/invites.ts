/**
 * Invites. Owners invite admins and users, admins invite users, users invite nobody. An invite is a link that fixes
 * the role, works once and lasts 7 days; only its token hash is stored. Accepting creates the account and signs it
 * in, in one transaction with a row lock, so one link makes exactly one account.
 */
import { invitableBy } from '#lib/roles';
import type { NewAccountInput } from '#lib/schemas/auth';
import { AppError } from '../errors';
import { db } from '../db';
import { config } from '../infra/config';
import * as invitesRepo from '../repos/invites';
import * as usersRepo from '../repos/users';
import { record, type Ctx } from './audit';
import { checkPassword, createSession, limitJoin, requireUser, toSessionUser } from './auth';
import { hashPassword, newToken, tokenHash } from './passwords';

const DAY = 24 * 60 * 60 * 1000;
export const INVITE_DAYS = 7;

/** The link for a token; relative when no ORIGIN is set (the page adds its own address). */
export const inviteLink = (token: string) =>
	`${(config().ORIGIN ?? '').replace(/\/$/, '')}/invite/${token}`;

export interface PendingInvite {
	id: string;
	role: 'admin' | 'user';
	note: string | null;
	createdBy: string;
	expiresAt: Date;
	createdAt: Date;
}

const toPending = (i: {
	id: string;
	role: 'admin' | 'user';
	note: string | null;
	createdBy: string;
	expiresAt: Date;
	createdAt: Date;
}): PendingInvite => ({
	id: i.id,
	role: i.role,
	note: i.note,
	createdBy: i.createdBy,
	expiresAt: i.expiresAt,
	createdAt: i.createdAt
});

/** Make an invite; the token (and link) is returned only now. */
export async function create(ctx: Ctx, input: { role: 'admin' | 'user'; note?: string }) {
	const me = requireUser(ctx);
	if (!invitableBy(me.role).includes(input.role))
		throw new AppError(
			'forbidden',
			input.role === 'admin' ? 'Only an owner can invite admins.' : 'You cannot invite people.'
		);
	const token = newToken();
	return db().transaction(async (tx) => {
		const invite = await invitesRepo.insert(tx, {
			tokenHash: tokenHash(token),
			role: input.role,
			note: input.note || null,
			createdBy: me.id,
			expiresAt: new Date(Date.now() + INVITE_DAYS * DAY)
		});
		await record(
			tx,
			ctx,
			'invite.created',
			{ type: 'invite', id: invite.id },
			{ role: input.role }
		);
		return { invite: toPending(invite), token, link: inviteLink(token) };
	});
}

/** Pending invites: all of them for owners, one's own for admins. */
export async function pending(ctx: Ctx) {
	const me = requireUser(ctx);
	if (!invitableBy(me.role).length) throw new AppError('forbidden', 'You cannot invite people.');
	return (await invitesRepo.pending(db(), me.role === 'owner' ? undefined : me.id)).map(toPending);
}

export async function revoke(ctx: Ctx, id: string) {
	const me = requireUser(ctx);
	await db().transaction(async (tx) => {
		const i = await invitesRepo.findById(tx, id);
		if (!i || (me.role !== 'owner' && i.createdBy !== me.id))
			throw new AppError('not_found', 'No such invite.');
		if (i.usedAt) throw new AppError('conflict', 'This invite was already used.');
		await invitesRepo.revoke(tx, id);
		await record(tx, ctx, 'invite.revoked', { type: 'invite', id });
	});
}

/** A fresh link for the same role and note; the old link stops working. */
export async function resend(ctx: Ctx, id: string) {
	const me = requireUser(ctx);
	const old = await invitesRepo.findById(db(), id);
	if (!old || (me.role !== 'owner' && old.createdBy !== me.id))
		throw new AppError('not_found', 'No such invite.');
	await revoke(ctx, id);
	return create(ctx, { role: old.role, note: old.note ?? '' });
}

/** What the invite page shows before someone joins. */
export async function preview(token: string) {
	const i = await invitesRepo.findByToken(db(), tokenHash(token));
	if (!i) return { state: 'unknown' as const };
	const inviter = await usersRepo.findById(db(), i.createdBy);
	const state = i.usedAt
		? ('used' as const)
		: i.revokedAt
			? ('revoked' as const)
			: i.expiresAt <= new Date()
				? ('expired' as const)
				: ('open' as const);
	return {
		state,
		role: i.role,
		note: i.note,
		inviter: inviter?.displayName ?? 'Someone',
		expiresAt: i.expiresAt
	};
}

export async function accept(token: string, input: NewAccountInput, ctx: Ctx) {
	limitJoin(ctx);
	checkPassword(input.password);
	const passwordHash = await hashPassword(input.password);
	return db().transaction(async (tx) => {
		const i = await invitesRepo.lockByToken(tx, tokenHash(token));
		if (!i || i.revokedAt)
			throw new AppError('not_found', 'This invite does not exist or was withdrawn.');
		if (i.usedAt)
			throw new AppError('conflict', 'This invite was already used. Ask for a new one.');
		if (i.expiresAt <= new Date())
			throw new AppError('conflict', 'This invite has expired. Ask for a new one.');
		const user = await usersRepo.insert(tx, {
			username: input.username,
			displayName: input.displayName,
			passwordHash,
			role: i.role,
			invitedBy: i.createdBy
		});
		if (!user)
			throw new AppError('invalid', 'Check the highlighted fields.', {
				username: 'That username is taken.'
			});
		await invitesRepo.markUsed(tx, i.id, user.id);
		const session = await createSession(tx, user.id, false, ctx);
		const actor = toSessionUser(user, tokenHash(session.token));
		await record(
			tx,
			{ ...ctx, actor },
			'invite.accepted',
			{ type: 'invite', id: i.id },
			{ role: i.role }
		);
		return { session, user: actor };
	});
}
