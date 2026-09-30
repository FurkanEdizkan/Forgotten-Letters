import { fail, redirect } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, createSession } from '$lib/server/auth';
import { lookupInvite, redeemInvite } from '$lib/server/muster';
import { auditAuth, clientMeta } from '$lib/server/audit';
import { publish } from '$lib/server/hub';
import { requestLimiter } from '$lib/server/requests';
import type { Actions, PageServerLoad } from './$types';

/** An invite link: take the seat it names by creating an account, signed in at once. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const found = await lookupInvite(params.token);
	return {
		state: found?.state ?? 'unknown',
		campaign: found?.campaign.name ?? null,
		seat: found ? { number: found.seat.seat, name: found.seat.name } : null,
		signedInAs: locals.user?.username ?? null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, params, cookies, url, getClientAddress } = event;
		const data = await request.formData();
		const username = String(data.get('username') ?? '').slice(0, 64);
		const displayName = String(data.get('displayName') ?? '').slice(0, 80);
		const email = String(data.get('email') ?? '').slice(0, 254);
		if (!(await requestLimiter.take(`ip:${getClientAddress()}`)))
			return fail(429, { username, displayName, email, message: 'Too many attempts from here. Wait a few minutes and try again.' });
		const r = await redeemInvite(params.token, {
			username,
			displayName,
			email,
			password: String(data.get('password') ?? '').slice(0, 200),
			confirm: String(data.get('confirm') ?? '').slice(0, 200)
		});
		if (!r.ok) return fail(400, { username, displayName, email, message: r.message });
		const { token, maxAge } = await createSession(r.userId, clientMeta(event));
		const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' } as const;
		cookies.set(SESSION_COOKIE, token, { ...opts, maxAge });
		cookies.delete(FORGET_COOKIE, { path: '/' });
		auditAuth(event, 'invite.used', { actorId: r.userId, actorName: username.trim().toLowerCase(), targetType: 'player', detail: { seat: r.seatName } });
		const found = await lookupInvite(params.token);
		if (found) publish(found.campaign.id);
		redirect(303, '/muster');
	}
};
