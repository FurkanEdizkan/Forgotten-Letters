import { error, fail } from '@sveltejs/kit';
import { and, asc, count, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, session, user, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { endAllSessions, envAdminUsername, forgetUserSessions, setPassword } from '$lib/server/auth';
import { MIN_PASSWORD, USERNAME, hashPassword, normaliseUsername, temporaryPassword } from '$lib/server/passwords';
import { approveSignup, declineRequest, listRequests, resolveReset } from '$lib/server/requests';
import { normaliseEmail } from '$lib/server/request-rules';
import { auditAuth } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const users = await db.select().from(user).orderBy(asc(user.role), asc(user.username));
	const live = await db
		.select({ userId: session.userId, n: count() })
		.from(session)
		.where(gt(session.expiresAt, new Date()))
		.groupBy(session.userId);
	const seats = await db
		.select({ id: player.id, seat: player.seat, name: player.name, userId: player.userId, warband: warband.name, warbandId: warband.id, faction: warband.faction })
		.from(player)
		.leftJoin(warband, eq(warband.playerId, player.id))
		.where(eq(player.campaignId, c.id))
		.orderBy(asc(player.seat), asc(player.name));
	return {
		users: users.map((u) => ({
			id: u.id,
			username: u.username,
			displayName: u.displayName,
			role: u.role,
			disabled: u.disabled,
			mustChangePassword: u.mustChangePassword,
			/** Defined by .env: its password, role and enabled state are re-applied at every start. */
			envManaged: u.username === envAdminUsername(),
			lastSignInAt: u.lastSignInAt,
			devices: live.find((l) => l.userId === u.id)?.n ?? 0,
			seats: seats.filter((s) => s.userId === u.id)
		})),
		seats,
		requests: await listRequests()
	};
};

async function target(id: FormDataEntryValue | null) {
	const [u] = await db.select().from(user).where(eq(user.id, String(id)));
	if (!u) error(404, 'No such account');
	return u;
}

const ENV_MANAGED = 'This account is defined in .env (ADMIN_USERNAME / ADMIN_PASSWORD); change it there and restart.';

/** Give these player seats to the account (and take any others it had away). */
async function assign(userId: string, playerIds: string[]) {
	// Seats given to this account may be taken from others: their cached rights change too.
	const before = playerIds.length ? await db.select({ userId: player.userId }).from(player).where(inArray(player.id, playerIds)) : [];
	await db.update(player).set({ userId: null }).where(eq(player.userId, userId));
	if (playerIds.length) await db.update(player).set({ userId }).where(inArray(player.id, playerIds));
	for (const id of new Set([userId, ...before.flatMap((b) => (b.userId ? [b.userId] : []))])) await forgetUserSessions(id);
}

export const actions: Actions = {
	create: async (event) => {
		const data = await event.request.formData();
		const username = normaliseUsername(String(data.get('username') ?? ''));
		const displayName = String(data.get('displayName') ?? '').trim().slice(0, 60) || null;
		const email = normaliseEmail(String(data.get('email') ?? ''));
		if (email === false) return fail(400, { createMessage: 'That email address does not look right.' });
		if (email && (await db.select({ id: user.id }).from(user).where(eq(user.email, email))).length)
			return fail(400, { createMessage: `“${email}” already belongs to an account.` });
		let password = String(data.get('password') ?? '');
		const role = data.get('role') === 'cm' ? 'cm' : 'player';
		if (!USERNAME.test(username)) return fail(400, { createMessage: 'Usernames are 2–32 lowercase letters, digits, dots, dashes or underscores.' });
		if (password && password.length < MIN_PASSWORD) return fail(400, { createMessage: `Passwords need at least ${MIN_PASSWORD} characters (or leave it blank to generate one).` });
		if ((await db.select({ id: user.id }).from(user).where(eq(user.username, username))).length)
			return fail(400, { createMessage: `“${username}” is taken.` });
		password ||= temporaryPassword();
		const [u] = await db
			.insert(user)
			.values({ username, displayName, email, role, passwordHash: await hashPassword(password), mustChangePassword: true })
			.returning({ id: user.id });
		await assign(u.id, data.getAll('players').map(String));
		auditAuth(event, 'account.create', { targetType: 'user', targetId: u.id, detail: { username, role } });
		return { issued: { username, password, why: 'created' } };
	},

	approve: async (event) => {
		const data = await event.request.formData();
		const r = await approveSignup(String(data.get('id')));
		if (!r.ok) return fail(409, { message: r.message });
		// Give a free seat at once if the Campaign Master picked one on the request.
		const seat = String(data.get('seat') ?? '');
		let seated = false;
		if (seat) {
			const c = await currentCampaign();
			if (c)
				seated = !!(
					await db
						.update(player)
						.set({ userId: r.userId })
						.where(and(eq(player.id, seat), eq(player.campaignId, c.id), isNull(player.userId)))
						.returning({ id: player.id })
				).length;
		}
		auditAuth(event, 'signup.approved', { targetType: 'user', detail: { username: r.username } });
		return {
			message: seated
				? `Account "${r.username}" approved and seated.`
				: seat
					? `Account "${r.username}" approved, but that seat was taken meanwhile: give it one below.`
					: `Account "${r.username}" approved. Give it a seat below.`
		};
	},

	decline: async (event) => {
		const id = String((await event.request.formData()).get('id'));
		await declineRequest(id);
		auditAuth(event, 'request.declined', { targetType: 'account_request', targetId: id });
		return { message: 'Request removed.' };
	},

	resolveReset: async (event) => {
		const r = await resolveReset(String((await event.request.formData()).get('id')));
		if (!r.ok) return fail(409, { message: r.message });
		auditAuth(event, 'reset.issued', { targetType: 'user', detail: { username: r.username, from: 'request' } });
		return { issued: { username: r.username, password: r.password, why: 'reset' as const } };
	},

	reset: async (event) => {
		const u = await target((await event.request.formData()).get('id'));
		if (u.username === envAdminUsername()) return fail(400, { message: ENV_MANAGED });
		const password = temporaryPassword();
		await setPassword(u.id, password, true);
		await endAllSessions(u.id);
		auditAuth(event, 'reset.issued', { targetType: 'user', targetId: u.id, detail: { username: u.username } });
		return { issued: { username: u.username, password, why: 'reset' } };
	},

	toggle: async (event) => {
		const { locals } = event;
		const u = await target((await event.request.formData()).get('id'));
		if (u.username === envAdminUsername()) return fail(400, { message: ENV_MANAGED });
		if (u.id === locals.user?.id) return fail(400, { message: 'You cannot disable your own account.' });
		await db.update(user).set({ disabled: !u.disabled }).where(eq(user.id, u.id));
		await forgetUserSessions(u.id);
		if (!u.disabled) await endAllSessions(u.id);
		auditAuth(event, u.disabled ? 'account.enable' : 'account.disable', { targetType: 'user', targetId: u.id, detail: { username: u.username } });
		return {};
	},

	signOut: async (event) => {
		const u = await target((await event.request.formData()).get('id'));
		await endAllSessions(u.id);
		auditAuth(event, 'account.signout-everywhere', { targetType: 'user', targetId: u.id, detail: { username: u.username } });
		return { message: `${u.username} is signed out everywhere.` };
	},

	assign: async (event) => {
		const data = await event.request.formData();
		const u = await target(data.get('id'));
		await assign(u.id, data.getAll('players').map(String));
		auditAuth(event, 'account.seats', { targetType: 'user', targetId: u.id, detail: { username: u.username, seats: data.getAll('players').length } });
		return { message: `Seats updated for ${u.username}.` };
	},

	remove: async (event) => {
		const { locals } = event;
		const u = await target((await event.request.formData()).get('id'));
		if (u.username === envAdminUsername()) return fail(400, { message: ENV_MANAGED });
		if (u.id === locals.user?.id) return fail(400, { message: 'You cannot delete your own account.' });
		if (u.role === 'cm') {
			const [{ n }] = await db.select({ n: count() }).from(user).where(and(eq(user.role, 'cm'), ne(user.id, u.id)));
			if (!n) return fail(400, { message: 'Keep at least one Campaign Master account.' });
		}
		await db.delete(user).where(eq(user.id, u.id));
		await forgetUserSessions(u.id);
		auditAuth(event, 'account.delete', { targetType: 'user', targetId: u.id, detail: { username: u.username } });
		return { message: `${u.username} deleted; their warbands stay.` };
	}
};
