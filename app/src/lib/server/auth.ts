import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { player, session, user, warband } from './db/schema';
import { hashPassword, newToken, rateLimiter, tokenHash, verifyPassword, normaliseUsername } from './passwords';
import { adminSyncPlan } from './admin-sync';
import { recordAudit } from './audit';
import { kv } from './redis';

export const SESSION_COOKIE = 'cf_session';
/** Set when "Remember me" was left unticked: the session cookie then ends with the browser. */
export const FORGET_COOKIE = 'cf_forget';
const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: string;
	/** The device's session (hashed token), for activity and "sign out this device". */
	sessionId: string;
	username: string;
	displayName: string | null;
	role: 'cm' | 'player';
	mustChangePassword: boolean;
	/** Warbands this account plays (and may edit). */
	warbandIds: string[];
}

/** Five tries a minute per username and per address (shared by every instance through Redis). */
export const loginLimiter = rateLimiter('login', 5, 60_000, kv);

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
		recordAudit({ category: 'auth', action: 'admin.sync', actorName: 'system', targetType: 'user', detail: { username, created: true } });
	} else if (plan.kind === 'update' && u) {
		await db
			.update(user)
			.set({ ...plan.fields, ...(plan.rehash ? { passwordHash: await hashPassword(password) } : {}) })
			.where(eq(user.id, u.id));
		await forgetUserSessions(u.id);
		if (plan.rehash) await endAllSessions(u.id);
		console.log(`Brought the Campaign Master account "${username}" in line with .env${plan.rehash ? ' (new password)' : ''}.`);
		recordAudit({ category: 'auth', action: 'admin.sync', actorName: 'system', targetType: 'user', targetId: u.id, detail: { username, ...plan.fields, newPassword: plan.rehash } });
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

export async function createSession(userId: string, { userAgent, ip }: { userAgent: string | null; ip: string | null }) {
	const token = newToken();
	await db.insert(session).values({
		idHash: tokenHash(token),
		userId,
		expiresAt: new Date(Date.now() + SESSION_DAYS * DAY),
		userAgent: userAgent?.slice(0, 200) ?? null,
		ip,
		lastIp: ip
	});
	// Signing in isn't an edit to the account: keep updatedAt.
	await db.update(user).set({ lastSignInAt: new Date(), lastSignInIp: ip, updatedAt: sql`${user.updatedAt}` }).where(eq(user.id, userId));
	return { token, maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

/*
 * Session cache: the signed-in user for a session is kept for a minute (in Redis when configured, so every
 * instance shares it) instead of two queries on every request. Anything that changes who may do what forgets it:
 * sign-out, sign-out everywhere, password changes, disabling, deletion, seat changes, the .env admin sync.
 */
const SESSION_CACHE_MS = 60_000;
const sessKey = (idHash: string) => `cf:sess:${idHash}`;
const userSessionsKey = (userId: string) => `cf:usess:${userId}`;

/** Forget one device's cached session. */
export async function forgetSession(idHash: string) {
	await kv().del(sessKey(idHash));
}

/** Forget every cached session of an account (its rights or devices changed). */
export async function forgetUserSessions(userId: string) {
	const store = kv();
	const hashes = await store.members(userSessionsKey(userId));
	await store.del(...hashes.map(sessKey), userSessionsKey(userId));
}

/** The signed-in user for a session cookie, or null. Sessions slide forward while in use. */
export async function sessionUser(token: string | undefined): Promise<SessionUser | null> {
	if (!token || token.length > 100) return null;
	const idHash = tokenHash(token);
	const cached = await kv()
		.get(sessKey(idHash))
		.catch(() => null);
	if (cached) {
		const { u, exp } = JSON.parse(cached) as { u: SessionUser; exp: number };
		if (exp > Date.now()) return u;
	}
	const [row] = await db
		.select({ s: session, u: user })
		.from(session)
		.innerJoin(user, eq(user.id, session.userId))
		.where(and(eq(session.idHash, idHash), gt(session.expiresAt, new Date())));
	if (!row || row.u.disabled) return null;
	// Slide the expiry forward about once a day while in use (lastSeenAt itself is kept by the activity flush).
	if (row.s.expiresAt.getTime() - Date.now() < (SESSION_DAYS - 1) * DAY)
		await db
			.update(session)
			.set({ expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) })
			.where(eq(session.idHash, row.s.idHash));
	const owned = await db
		.select({ id: warband.id })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(eq(player.userId, row.u.id));
	const found: SessionUser = {
		id: row.u.id,
		sessionId: row.s.idHash,
		username: row.u.username,
		displayName: row.u.displayName,
		role: row.u.role,
		mustChangePassword: row.u.mustChangePassword,
		warbandIds: owned.map((w) => w.id)
	};
	const store = kv();
	await Promise.all([
		store.set(sessKey(idHash), JSON.stringify({ u: found, exp: row.s.expiresAt.getTime() }), SESSION_CACHE_MS),
		store.addToSet(userSessionsKey(found.id), idHash, SESSION_CACHE_MS)
	]).catch((e) => console.error('session cache:', e));
	return found;
}

export async function endSession(token: string | undefined) {
	if (!token) return;
	await db.delete(session).where(eq(session.idHash, tokenHash(token)));
	await forgetSession(tokenHash(token));
}

/** Sign an account out everywhere (after a reset, a disable, or on request). */
export async function endAllSessions(userId: string) {
	await db.delete(session).where(eq(session.userId, userId));
	await forgetUserSessions(userId);
}

export async function pruneSessions() {
	await db.delete(session).where(lt(session.expiresAt, new Date()));
}

export async function setPassword(userId: string, password: string, mustChange: boolean) {
	await db
		.update(user)
		.set({ passwordHash: await hashPassword(password), mustChangePassword: mustChange })
		.where(eq(user.id, userId));
	await forgetUserSessions(userId);
}

/** Can this user edit the warband? The CM can edit any; a player only their own. */
export const canEditWarband = (u: SessionUser | null, warbandId: string) =>
	!!u && (u.role === 'cm' || u.warbandIds.includes(warbandId));

