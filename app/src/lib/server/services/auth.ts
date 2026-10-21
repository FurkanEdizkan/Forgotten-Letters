/**
 * Sign-in and sessions. A session is a random token in an httpOnly cookie; only its SHA-256 is stored. With
 * "Remember me" it lasts 30 days and each use extends it; without, the cookie ends with the browser (the stored
 * session still expires after a day without use).
 */
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as sessionsRepo from '../repos/sessions';
import * as usersRepo from '../repos/users';
import { slidingWindow } from '../infra/rate-limit';
import { record, type Ctx, type SessionUser } from './audit';
import {
	DUMMY_HASH,
	hashPassword,
	isCommonPassword,
	needsRehash,
	newToken,
	tokenHash,
	verifyPassword
} from './passwords';
import type { SignInInput } from '#lib/schemas/auth';

const DAY = 24 * 60 * 60 * 1000;
export const REMEMBER_DAYS = 30;
const SHORT_DAYS = 1;

/** Five tries a minute per username and per address. */
export const signInLimiter = slidingWindow(5, 60_000);

const lifetime = (remember: boolean) => (remember ? REMEMBER_DAYS : SHORT_DAYS) * DAY;

export interface NewSession {
	token: string;
	/** Cookie max-age in seconds, or null for a browser-session cookie. */
	maxAge: number | null;
}

export async function createSession(
	tx: Tx,
	userId: string,
	remember: boolean,
	ctx: Ctx
): Promise<NewSession> {
	const token = newToken();
	await sessionsRepo.insert(tx, {
		idHash: tokenHash(token),
		userId,
		remember,
		expiresAt: new Date(Date.now() + lifetime(remember)),
		userAgent: ctx.userAgent?.slice(0, 200) ?? null,
		ip: ctx.ip
	});
	await usersRepo.touchSignIn(tx, userId);
	return { token, maxAge: remember ? (REMEMBER_DAYS * DAY) / 1000 : null };
}

/** Check a username and password and start a session. Same message for a wrong password and an unknown name. */
export async function signIn(input: SignInInput, ctx: Ctx) {
	const name = input.username.trim().toLowerCase();
	// Only failures count, so a table of players signing in from one venue network is never locked out.
	const keys = [`u:${name}`, `ip:${ctx.ip ?? '?'}`];
	const wait = signInLimiter.peek(...keys);
	if (wait)
		throw new AppError(
			'rate_limited',
			`Too many tries. Wait ${wait} seconds and try again.`,
			undefined,
			wait
		);

	const user = await usersRepo.findByUsername(db(), name);
	const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
	if (!user || !ok || user.disabledAt) {
		signInLimiter.take(...keys);
		await record(db(), ctx, 'sign_in.failed', user ? { type: 'user', id: user.id } : null, {
			username: name.slice(0, 32)
		});
		throw new AppError('unauthenticated', 'Wrong username or password.');
	}
	signInLimiter.clear(`u:${name}`);
	return db().transaction(async (tx) => {
		if (needsRehash(user.passwordHash))
			await usersRepo.update(tx, user.id, { passwordHash: await hashPassword(input.password) });
		const session = await createSession(tx, user.id, input.remember, ctx);
		await record(
			tx,
			{ ...ctx, actor: toSessionUser(user, '') },
			'sign_in',
			{ type: 'user', id: user.id },
			{ remember: input.remember }
		);
		return { session, user: toSessionUser(user, tokenHash(session.token)) };
	});
}

export function toSessionUser(u: usersRepo.UserRow, sessionHash: string): SessionUser {
	return {
		id: u.id,
		username: u.username,
		displayName: u.displayName,
		role: u.role,
		mustChangePassword: u.mustChangePassword,
		sessionHash
	};
}

/**
 * The signed-in user for a cookie token, or null. A session in use slides forward: remembered ones about once a
 * day, short ones on every use.
 */
export async function resolveSession(
	token: string | undefined
): Promise<{ user: SessionUser; renew: NewSession | null } | null> {
	if (!token || token.length > 100) return null;
	const idHash = tokenHash(token);
	const row = await sessionsRepo.findLive(db(), idHash);
	if (!row || row.user.disabledAt) return null;
	const full = lifetime(row.session.remember);
	const left = row.session.expiresAt.getTime() - Date.now();
	let renew: NewSession | null = null;
	if (full - left > (row.session.remember ? DAY : 5 * 60 * 1000)) {
		await sessionsRepo.slide(db(), idHash, new Date(Date.now() + full));
		renew = { token, maxAge: row.session.remember ? full / 1000 : null };
	}
	return { user: toSessionUser(row.user, idHash), renew };
}

export async function signOut(ctx: Ctx) {
	if (!ctx.actor) return;
	await db().transaction(async (tx) => {
		await sessionsRepo.remove(tx, ctx.actor!.sessionHash);
		await record(tx, ctx, 'sign_out', { type: 'user', id: ctx.actor!.id });
	});
}

/** End every session of the signed-in person except this device's. */
export async function signOutEverywhere(ctx: Ctx) {
	const me = requireUser(ctx);
	await db().transaction(async (tx) => {
		await sessionsRepo.removeForUser(tx, me.id, me.sessionHash);
		await record(tx, ctx, 'sign_out.everywhere', { type: 'user', id: me.id });
	});
}

/** End every session of an account (disable, password reset). */
export const endSessions = (tx: Tx, userId: string) => sessionsRepo.removeForUser(tx, userId);

export async function changePassword(ctx: Ctx, current: string, next: string) {
	const me = requireUser(ctx);
	const user = await usersRepo.findById(db(), me.id);
	if (!user || !(await verifyPassword(current, user.passwordHash)))
		throw new AppError('invalid', 'Check the highlighted fields.', {
			current: 'That is not your current password.'
		});
	if (isCommonPassword(next))
		throw new AppError('invalid', 'Check the highlighted fields.', {
			password: 'That password is too common. Choose another.'
		});
	if (current === next)
		throw new AppError('invalid', 'Check the highlighted fields.', {
			password: 'Choose a password different from the current one.'
		});
	await db().transaction(async (tx) => {
		await usersRepo.update(tx, me.id, {
			passwordHash: await hashPassword(next),
			mustChangePassword: false
		});
		await sessionsRepo.removeForUser(tx, me.id, me.sessionHash);
		await record(tx, ctx, 'password.changed', { type: 'user', id: me.id });
	});
}

export async function setDisplayName(ctx: Ctx, displayName: string) {
	const me = requireUser(ctx);
	await db().transaction(async (tx) => {
		await usersRepo.update(tx, me.id, { displayName });
		await record(tx, ctx, 'display_name.changed', { type: 'user', id: me.id });
	});
}

export const devices = (ctx: Ctx) => sessionsRepo.listForUser(db(), requireUser(ctx).id);

export function requireUser(ctx: Ctx): SessionUser {
	if (!ctx.actor) throw new AppError('unauthenticated', 'Sign in first.');
	return ctx.actor;
}

/** Joining by invite and first-owner setup: five tries a minute per address. */
export const joinLimiter = slidingWindow(5, 60_000);

export function limitJoin(ctx: Ctx) {
	const wait = joinLimiter.take(`ip:${ctx.ip ?? '?'}`);
	if (wait)
		throw new AppError(
			'rate_limited',
			`Too many tries. Wait ${wait} seconds and try again.`,
			undefined,
			wait
		);
}

/** Refuse common passwords with a field message. */
export function checkPassword(password: string) {
	if (isCommonPassword(password))
		throw new AppError('invalid', 'Check the highlighted fields.', {
			password: 'That password is too common. Choose another.'
		});
}
