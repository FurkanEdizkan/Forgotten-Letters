import { fail, redirect } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, authenticate, createSession, loginLimiter } from '$lib/server/auth';
import { normaliseUsername } from '$lib/server/passwords';
import { requestLimiter, requestReset, requestSignup } from '$lib/server/requests';
import { safeNext } from '$lib/server/safe-next';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), url.origin) ?? '/');
	return {};
};

export const actions: Actions = {
	signin: async ({ request, cookies, url, getClientAddress }) => {
		const data = await request.formData();
		const username = normaliseUsername(String(data.get('username') ?? '')).slice(0, 32);
		const password = String(data.get('password') ?? '').slice(0, 200);
		if (!loginLimiter.take(`ip:${getClientAddress()}`) || !loginLimiter.take(`user:${username}`))
			return fail(429, { tab: 'signin' as const, username, message: 'Too many attempts. Wait a minute and try again.' });
		const u = await authenticate(username, password);
		if (!u)
			return fail(401, {
				tab: 'signin' as const,
				username,
				message: 'That username and password do not match, or the account is disabled.'
			});
		loginLimiter.clear(`user:${username}`);
		const { token, maxAge } = await createSession(u.id, request.headers.get('user-agent'));
		// "Remember me": a cookie that lasts the session's 30 days; otherwise one that ends when the browser closes.
		const remember = data.has('remember');
		const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' } as const;
		cookies.set(SESSION_COOKIE, token, remember ? { ...opts, maxAge } : opts);
		if (remember) cookies.delete(FORGET_COOKIE, { path: '/' });
		else cookies.set(FORGET_COOKIE, '1', opts);
		if (u.mustChangePassword) redirect(303, '/settings?first=1');
		redirect(303, safeNext(url.searchParams.get('next'), url.origin) ?? (u.role === 'cm' ? '/admin' : '/'));
	},

	signup: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').slice(0, 64);
		const displayName = String(data.get('displayName') ?? '').slice(0, 80);
		const r = await requestSignup(
			{
				username,
				displayName,
				password: String(data.get('password') ?? '').slice(0, 200),
				confirm: String(data.get('confirm') ?? '').slice(0, 200)
			},
			`ip:${getClientAddress()}`
		);
		if (!r.ok) return fail(r.status, { tab: 'signup' as const, username, displayName, message: r.message });
		return { tab: 'signup' as const, sent: true };
	},

	reset: async ({ request, getClientAddress }) => {
		const username = String((await request.formData()).get('username') ?? '').slice(0, 64);
		if (!requestLimiter.take(`ip:${getClientAddress()}`))
			return fail(429, { tab: 'reset' as const, username, message: 'Too many requests from here. Wait a few minutes and try again.' });
		await requestReset(username);
		return { tab: 'reset' as const, sent: true };
	}
};
