import { error, fail } from '@sveltejs/kit';
import { and, asc, count, eq, gt, inArray, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, session, user, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { endAllSessions, envAdminUsername, setPassword } from '$lib/server/auth';
import { MIN_PASSWORD, USERNAME, hashPassword, normaliseUsername, temporaryPassword } from '$lib/server/passwords';
import { approveSignup, declineRequest, listRequests, resolveReset } from '$lib/server/requests';
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
	await db.update(player).set({ userId: null }).where(eq(player.userId, userId));
	if (playerIds.length) await db.update(player).set({ userId }).where(inArray(player.id, playerIds));
}

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const username = normaliseUsername(String(data.get('username') ?? ''));
		const displayName = String(data.get('displayName') ?? '').trim().slice(0, 60) || null;
		let password = String(data.get('password') ?? '');
		const role = data.get('role') === 'cm' ? 'cm' : 'player';
		if (!USERNAME.test(username)) return fail(400, { createMessage: 'Usernames are 2–32 lowercase letters, digits, dots, dashes or underscores.' });
		if (password && password.length < MIN_PASSWORD) return fail(400, { createMessage: `Passwords need at least ${MIN_PASSWORD} characters (or leave it blank to generate one).` });
		if ((await db.select({ id: user.id }).from(user).where(eq(user.username, username))).length)
			return fail(400, { createMessage: `“${username}” is taken.` });
		password ||= temporaryPassword();
		const [u] = await db
			.insert(user)
			.values({ username, displayName, role, passwordHash: await hashPassword(password), mustChangePassword: true })
			.returning({ id: user.id });
		await assign(u.id, data.getAll('players').map(String));
		return { issued: { username, password, why: 'created' } };
	},

	approve: async ({ request }) => {
		const r = await approveSignup(String((await request.formData()).get('id')));
		if (!r.ok) return fail(409, { message: r.message });
		return { message: `Account "${r.username}" approved. Give it a seat below.` };
	},

	decline: async ({ request }) => {
		await declineRequest(String((await request.formData()).get('id')));
		return { message: 'Request removed.' };
	},

	resolveReset: async ({ request }) => {
		const r = await resolveReset(String((await request.formData()).get('id')));
		if (!r.ok) return fail(409, { message: r.message });
		return { issued: { username: r.username, password: r.password, why: 'reset' as const } };
	},

	reset: async ({ request }) => {
		const u = await target((await request.formData()).get('id'));
		if (u.username === envAdminUsername()) return fail(400, { message: ENV_MANAGED });
		const password = temporaryPassword();
		await setPassword(u.id, password, true);
		await endAllSessions(u.id);
		return { issued: { username: u.username, password, why: 'reset' } };
	},

	toggle: async ({ request, locals }) => {
		const u = await target((await request.formData()).get('id'));
		if (u.username === envAdminUsername()) return fail(400, { message: ENV_MANAGED });
		if (u.id === locals.user?.id) return fail(400, { message: 'You cannot disable your own account.' });
		await db.update(user).set({ disabled: !u.disabled }).where(eq(user.id, u.id));
		if (!u.disabled) await endAllSessions(u.id);
		return {};
	},

	signOut: async ({ request }) => {
		const u = await target((await request.formData()).get('id'));
		await endAllSessions(u.id);
		return { message: `${u.username} is signed out everywhere.` };
	},

	assign: async ({ request }) => {
		const data = await request.formData();
		const u = await target(data.get('id'));
		await assign(u.id, data.getAll('players').map(String));
		return { message: `Seats updated for ${u.username}.` };
	},

	remove: async ({ request, locals }) => {
		const u = await target((await request.formData()).get('id'));
		if (u.username === envAdminUsername()) return fail(400, { message: ENV_MANAGED });
		if (u.id === locals.user?.id) return fail(400, { message: 'You cannot delete your own account.' });
		if (u.role === 'cm') {
			const [{ n }] = await db.select({ n: count() }).from(user).where(and(eq(user.role, 'cm'), ne(user.id, u.id)));
			if (!n) return fail(400, { message: 'Keep at least one Campaign Master account.' });
		}
		await db.delete(user).where(eq(user.id, u.id));
		return { message: `${u.username} deleted; their warbands stay.` };
	}
};
