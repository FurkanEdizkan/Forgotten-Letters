import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, gt, gte, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { auditLog, session, user, userActivity } from '$lib/server/db/schema';
import { envAdminUsername, forgetSession } from '$lib/server/auth';
import { auditAuth } from '$lib/server/audit';
import { deviceLabel } from '$lib/server/activity-rules';
import { normaliseEmail } from '$lib/server/request-rules';
import type { Actions, PageServerLoad } from './$types';

const DAY = 24 * 60 * 60 * 1000;

async function account(id: string) {
	const [u] = await db.select().from(user).where(eq(user.id, id));
	if (!u) error(404, 'No such account');
	return u;
}

/** One account as the Campaign Master sees it: who, the devices signed in, what happened to it, and how much it is used. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const u = await account(params.id);
	const devices = await db
		.select()
		.from(session)
		.where(and(eq(session.userId, u.id), gt(session.expiresAt, new Date())))
		.orderBy(desc(session.lastSeenAt));
	const history = await db
		.select()
		.from(auditLog)
		// Failed sign-ins and requests have no actor: they name the account in detail.username.
		.where(and(eq(auditLog.category, 'auth'), or(eq(auditLog.actorId, u.id), eq(auditLog.targetId, u.id), sql`${auditLog.detail}->>'username' = ${u.username}`)))
		.orderBy(desc(auditLog.at))
		.limit(50);
	const since = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
	const activity = await db
		.select()
		.from(userActivity)
		.where(and(eq(userActivity.userId, u.id), gte(userActivity.day, since)))
		.orderBy(desc(userActivity.day));
	return {
		account: {
			id: u.id,
			username: u.username,
			displayName: u.displayName,
			email: u.email,
			role: u.role,
			disabled: u.disabled,
			envManaged: u.username === envAdminUsername(),
			createdAt: u.createdAt,
			lastSignInAt: u.lastSignInAt,
			lastSignInIp: u.lastSignInIp,
			lastSeenAt: u.lastSeenAt
		},
		devices: devices.map((s) => ({
			id: s.idHash,
			label: deviceLabel(s.userAgent),
			userAgent: s.userAgent,
			ip: s.ip,
			lastIp: s.lastIp,
			createdAt: s.createdAt,
			lastSeenAt: s.lastSeenAt,
			current: s.idHash === locals.user?.sessionId
		})),
		history: history.map((h) => ({ ...h, device: deviceLabel(h.userAgent) })),
		activity
	};
};

export const actions: Actions = {
	/** Sign out one device of this account. */
	endDevice: async (event) => {
		const u = await account(event.params.id);
		const id = String((await event.request.formData()).get('session') ?? '');
		await db.delete(session).where(and(eq(session.idHash, id), eq(session.userId, u.id)));
		await forgetSession(id);
		auditAuth(event, 'account.signout-device', { targetType: 'user', targetId: u.id, detail: { username: u.username } });
		return { message: 'That device is signed out.' };
	},

	email: async (event) => {
		const u = await account(event.params.id);
		const email = normaliseEmail(String((await event.request.formData()).get('email') ?? ''));
		if (email === false) return fail(400, { message: 'That email address does not look right.' });
		if (email) {
			const [other] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
			if (other && other.id !== u.id) return fail(400, { message: `“${email}” already belongs to another account.` });
		}
		await db.update(user).set({ email }).where(eq(user.id, u.id));
		auditAuth(event, 'account.email', { targetType: 'user', targetId: u.id, detail: { username: u.username } });
		return { message: email ? 'Email saved.' : 'Email removed.' };
	}
};
