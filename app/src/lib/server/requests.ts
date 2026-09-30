import { and, asc, count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { accountRequest, user } from '$lib/server/db/schema';
import { endAllSessions, setPassword } from '$lib/server/auth';
import { hashPassword, normaliseUsername, rateLimiter, temporaryPassword } from '$lib/server/passwords';
import { MAX_PENDING_SIGNUPS, checkSignup, type SignupInput } from '$lib/server/request-rules';

/** Both public forms share it, per client address: five requests every ten minutes. */
export const requestLimiter = rateLimiter(5, 10 * 60_000);

export interface PendingRequest {
	id: string;
	kind: 'signup' | 'reset';
	username: string;
	displayName: string | null;
	createdAt: Date;
}

/** A visitor asks for an account. It stays a request until the Campaign Master approves it. */
export async function requestSignup(
	input: SignupInput
): Promise<{ ok: true } | { ok: false; status: 400 | 429; message: string }> {
	const checked = checkSignup(input);
	if (!checked.ok) return { ok: false, status: 400, message: checked.message };
	const { username, displayName, password } = checked.value;
	const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
	const [asked] = await db
		.select({ id: accountRequest.id })
		.from(accountRequest)
		.where(and(eq(accountRequest.kind, 'signup'), eq(accountRequest.username, username)));
	if (taken || asked) return { ok: false, status: 400, message: 'That username is taken. Choose another.' };
	const [{ n }] = await db.select({ n: count() }).from(accountRequest).where(eq(accountRequest.kind, 'signup'));
	if (n >= MAX_PENDING_SIGNUPS)
		return { ok: false, status: 429, message: 'The Campaign Master has too many requests waiting. Try again later.' };
	// The unique index settles a race between two identical requests.
	await db
		.insert(accountRequest)
		.values({ kind: 'signup', username, displayName, passwordHash: await hashPassword(password) })
		.onConflictDoNothing();
	return { ok: true };
}

/** A visitor has forgotten their password. Stored only for an enabled account; the caller answers the same either way. */
export async function requestReset(rawUsername: string) {
	const username = normaliseUsername(rawUsername).slice(0, 32);
	const [u] = await db.select({ disabled: user.disabled }).from(user).where(eq(user.username, username));
	if (!u || u.disabled) return;
	await db.insert(accountRequest).values({ kind: 'reset', username }).onConflictDoNothing();
}

/** Everything waiting, oldest first. Password hashes never leave this module. */
export async function listRequests(): Promise<PendingRequest[]> {
	return db
		.select({
			id: accountRequest.id,
			kind: accountRequest.kind,
			username: accountRequest.username,
			displayName: accountRequest.displayName,
			createdAt: accountRequest.createdAt
		})
		.from(accountRequest)
		.orderBy(asc(accountRequest.createdAt));
}

/** Turn a sign-up request into a player account with the password they chose. */
export async function approveSignup(id: string): Promise<{ ok: true; username: string } | { ok: false; message: string }> {
	return db.transaction(async (tx) => {
		const [r] = await tx
			.select()
			.from(accountRequest)
			.where(and(eq(accountRequest.id, id), eq(accountRequest.kind, 'signup')));
		if (!r?.passwordHash) return { ok: false as const, message: 'That request is gone.' };
		const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.username, r.username));
		if (taken)
			return { ok: false as const, message: `"${r.username}" is already an account. Decline this request instead.` };
		await tx.insert(user).values({
			username: r.username,
			displayName: r.displayName,
			passwordHash: r.passwordHash,
			role: 'player',
			mustChangePassword: false
		});
		await tx.delete(accountRequest).where(eq(accountRequest.id, id));
		return { ok: true as const, username: r.username };
	});
}

/** Decline a sign-up or dismiss a reset request. */
export async function declineRequest(id: string) {
	await db.delete(accountRequest).where(eq(accountRequest.id, id));
}

/** Answer a reset request with a temporary password, exactly as Admin → Players → Reset password does. */
export async function resolveReset(
	id: string
): Promise<{ ok: true; username: string; password: string } | { ok: false; message: string }> {
	const [r] = await db
		.select()
		.from(accountRequest)
		.where(and(eq(accountRequest.id, id), eq(accountRequest.kind, 'reset')));
	if (!r) return { ok: false, message: 'That request is gone.' };
	await db.delete(accountRequest).where(eq(accountRequest.id, id));
	const [u] = await db.select({ id: user.id, username: user.username }).from(user).where(eq(user.username, r.username));
	if (!u) return { ok: false, message: `There is no account "${r.username}" any more.` };
	const password = temporaryPassword();
	await setPassword(u.id, password, true);
	await endAllSessions(u.id);
	return { ok: true, username: u.username, password };
}
