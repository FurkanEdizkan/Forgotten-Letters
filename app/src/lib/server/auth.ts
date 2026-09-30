import { and, eq, gt, lt } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { player, session, user, warband } from './db/schema';
import { hashPassword, newToken, rateLimiter, tokenHash, verifyPassword, normaliseUsername } from './passwords';
import { adminSyncPlan } from './admin-sync';

export const SESSION_COOKIE = 'cf_session';
/** Set when "Remember me" was left unticked: the session cookie then ends with the browser. */
export const FORGET_COOKIE = 'cf_forget';
const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: string;
	username: string;
	displayName: string | null;
	role: 'cm' | 'player';
	mustChangePassword: boolean;
	/** Warbands this account plays (and may edit). */
	warbandIds: string[];
}

/** Five tries a minute per username and per address. */
export const loginLimiter = rateLimiter(5, 60_000);

/** The account .env defines (ADMIN_USERNAME, default `cm`), or null when ADMIN_PASSWORD is unset. */
export function envAdminUsername(): string | null {
	return env.ADMIN_PASSWORD ? normaliseUsername(env.ADMIN_USERNAME || 'cm').slice(0, 32) : null;
}

/**
 * Every start: the account named in .env is a working Campaign Master with the .env password (ADMIN_USERNAME,
 * ADMIN_PASSWORD). The password is re-applied only when it no longer matches, which also signs that account
 * out everywhere. Without ADMIN_PASSWORD, only make sure some Campaign Master exists, as before.
 */
export async function syncAdminAccount() {
	const username = envAdminUsername();
	if (!username) {
		const [cm] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'cm')).limit(1);
		if (cm) return;
		console.warn('ADMIN_PASSWORD is not set: creating Campaign Master "cm" with password "changeme". Set ADMIN_PASSWORD in .env.');
		await db.insert(user).values({ username: 'cm', displayName: 'Campaign Master', role: 'cm', passwordHash: await hashPassword('changeme') });
		return;
	}
	const password = env.ADMIN_PASSWORD!;
	const [u] = await db.select().from(user).where(eq(user.username, username));
	const plan = adminSyncPlan(
		u ? { role: u.role, disabled: u.disabled, mustChangePassword: u.mustChangePassword, passwordMatches: await verifyPassword(password, u.passwordHash) } : null
	);
	if (plan.kind === 'create') {
		await db.insert(user).values({
			username,
			displayName: 'Campaign Master',
			role: 'cm',
			passwordHash: await hashPassword(password),
			mustChangePassword: false
		});
		console.log(`Created the Campaign Master account "${username}" from .env.`);
	} else if (plan.kind === 'update' && u) {
		await db
			.update(user)
			.set({ ...plan.fields, ...(plan.rehash ? { passwordHash: await hashPassword(password) } : {}) })
			.where(eq(user.id, u.id));
		if (plan.rehash) await endAllSessions(u.id);
		console.log(`Brought the Campaign Master account "${username}" in line with .env${plan.rehash ? ' (new password)' : ''}.`);
	}
}

/** Check a username and password; the user row on success. Disabled accounts cannot sign in. */
export async function authenticate(username: string, password: string) {
	const [u] = await db.select().from(user).where(eq(user.username, normaliseUsername(username)));
	// Verify even when the user doesn't exist, so timing doesn't reveal usernames.
	const ok = await verifyPassword(password, u?.passwordHash ?? 'scrypt$16384$8$1$AAAA$AAAA');
	if (!u || !ok || u.disabled) return null;
	return u;
}

export async function createSession(userId: string, userAgent: string | null) {
	const token = newToken();
	await db.insert(session).values({
		idHash: tokenHash(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DAYS * DAY),
		userAgent: userAgent?.slice(0, 200) ?? null
	});
	await db.update(user).set({ lastSignInAt: new Date() }).where(eq(user.id, userId));
	return { token, maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

/** The signed-in user for a session cookie, or null. Sessions slide forward while in use. */
export async function sessionUser(token: string | undefined): Promise<SessionUser | null> {
	if (!token || token.length > 100) return null;
	const [row] = await db
		.select({ s: session, u: user })
		.from(session)
		.innerJoin(user, eq(user.id, session.userId))
		.where(and(eq(session.idHash, tokenHash(token)), gt(session.expiresAt, new Date())));
	if (!row || row.u.disabled) return null;
	if (Date.now() - row.s.lastSeenAt.getTime() > DAY)
		await db
			.update(session)
			.set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) })
			.where(eq(session.idHash, row.s.idHash));
	const owned = await db
		.select({ id: warband.id })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(eq(player.userId, row.u.id));
	return {
		id: row.u.id,
		username: row.u.username,
		displayName: row.u.displayName,
		role: row.u.role,
		mustChangePassword: row.u.mustChangePassword,
		warbandIds: owned.map((w) => w.id)
	};
}

export async function endSession(token: string | undefined) {
	if (token) await db.delete(session).where(eq(session.idHash, tokenHash(token)));
}

/** Sign an account out everywhere (after a reset, a disable, or on request). */
export async function endAllSessions(userId: string) {
	await db.delete(session).where(eq(session.userId, userId));
}

export async function pruneSessions() {
	await db.delete(session).where(lt(session.expiresAt, new Date()));
}

export async function setPassword(userId: string, password: string, mustChange: boolean) {
	await db
		.update(user)
		.set({ passwordHash: await hashPassword(password), mustChangePassword: mustChange })
		.where(eq(user.id, userId));
}

/** Can this user edit the warband? The CM can edit any; a player only their own. */
export const canEditWarband = (u: SessionUser | null, warbandId: string) =>
	!!u && (u.role === 'cm' || u.warbandIds.includes(warbandId));

