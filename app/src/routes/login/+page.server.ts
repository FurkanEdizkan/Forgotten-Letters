import { fail, redirect } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, authenticate, createSession, loginLimiter } from '$lib/server/auth';
import { normaliseUsername } from '$lib/server/passwords';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, url.searchParams.get('next') ?? '/');
	return {};
};

/** Only same-site paths are followed after sign-in. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const data = await request.formData();
		const username = normaliseUsername(String(data.get('username') ?? '')).slice(0, 32);
		const password = String(data.get('password') ?? '').slice(0, 200);
		if (!loginLimiter.take(`ip:${getClientAddress()}`) || !loginLimiter.take(`user:${username}`))
			return fail(429, { username, message: 'Too many attempts. Wait a minute and try again.' });
		const u = await authenticate(username, password);
		if (!u) return fail(401, { username, message: 'That username and password do not match, or the account is disabled.' });
		loginLimiter.clear(`user:${username}`);
		const { token, maxAge } = await createSession(u.id, request.headers.get('user-agent'));
		// "Remember me": a cookie that lasts the session's 30 days; otherwise one that ends when the browser closes.
		const remember = data.has('remember');
		const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' } as const;
		cookies.set(SESSION_COOKIE, token, remember ? { ...opts, maxAge } : opts);
		if (remember) cookies.delete(FORGET_COOKIE, { path: '/' });
		else cookies.set(FORGET_COOKIE, '1', opts);
		if (u.mustChangePassword) redirect(303, '/settings?first=1');
		redirect(303, safeNext(url.searchParams.get('next')) ?? (u.role === 'cm' ? '/admin' : '/'));
	}
};
