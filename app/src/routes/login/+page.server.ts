import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, authenticate, createSession, loginLimiter } from '$lib/server/auth';
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
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge
		});
		if (u.mustChangePassword) redirect(303, '/account?first=1');
		redirect(303, safeNext(url.searchParams.get('next')) ?? (u.role === 'cm' ? '/admin' : '/'));
	}
};
