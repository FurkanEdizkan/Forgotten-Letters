import { fail, redirect } from '@sveltejs/kit';
import { signIn } from '$lib/server/signin';
import { normaliseUsername } from '$lib/server/passwords';
import { requestLimiter, requestReset, requestSignup } from '$lib/server/requests';
import { safeNext } from '$lib/server/safe-next';
import { auditAuth, clientAddress } from '$lib/server/audit';
import { accessMode, landingFor } from '$lib/server/access';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	const mode = accessMode(env.ACCESS);
	// Signed in already: on to `next` only if this account may open it (a player sent here from /admin would loop).
	if (locals.user) redirect(303, landingFor(mode, locals.user, safeNext(url.searchParams.get('next'), url.origin)));
	return { private: mode === 'private' };
};

export const actions: Actions = {
	signin: (event) => signIn(event, 'players'),

	signup: async (event) => {
		const { request } = event;
		const data = await request.formData();
		const username = String(data.get('username') ?? '').slice(0, 64);
		const displayName = String(data.get('displayName') ?? '').slice(0, 80);
		const email = String(data.get('email') ?? '').slice(0, 254);
		const r = await requestSignup(
			{
				username,
				displayName,
				email,
				password: String(data.get('password') ?? '').slice(0, 200),
				confirm: String(data.get('confirm') ?? '').slice(0, 200)
			},
			`ip:${clientAddress(event)}`
		);
		if (!r.ok) return fail(r.status, { tab: 'signup' as const, username, displayName, email, message: r.message });
		auditAuth(event, 'signup.request', { detail: { username: normaliseUsername(username) } });
		return { tab: 'signup' as const, sent: true };
	},

	reset: async (event) => {
		const { request } = event;
		const username = String((await request.formData()).get('username') ?? '').slice(0, 64);
		if (!(await requestLimiter.take(`ip:${clientAddress(event)}`)))
			return fail(429, { tab: 'reset' as const, username, message: 'Too many requests from here. Wait a few minutes and try again.' });
		await requestReset(username);
		auditAuth(event, 'reset.request', { detail: { username: normaliseUsername(username) } });
		return { tab: 'reset' as const, sent: true };
	}
};
