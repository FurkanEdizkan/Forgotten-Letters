import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { FORGET_COOKIE, SESSION_COOKIE, createSession, endAllSessions, envAdminUsername, setPassword } from '$lib/server/auth';
import { MIN_PASSWORD, verifyPassword } from '$lib/server/passwords';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.user) redirect(303, '/login?next=/settings');
	return {
		/** A password the Campaign Master handed over: nothing else is reachable until it is changed. */
		first: url.searchParams.has('first') || locals.user.mustChangePassword,
		isAdmin: locals.isAdmin,
		/** This account's password comes from .env and is re-applied at every start. */
		envManaged: locals.user.username === envAdminUsername()
	};
};

export const actions: Actions = {
	password: async ({ request, locals, cookies, url }) => {
		if (!locals.user) redirect(303, '/login');
		if (locals.user.username === envAdminUsername())
			return fail(400, { message: "This account's password is set in .env (ADMIN_PASSWORD). Change it there and restart." });
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		const again = String(data.get('again') ?? '');
		const [u] = await db.select().from(user).where(eq(user.id, locals.user.id));
		if (!u || !(await verifyPassword(current, u.passwordHash))) return fail(400, { message: 'Your current password is not right.' });
		if (next.length < MIN_PASSWORD) return fail(400, { message: `Choose at least ${MIN_PASSWORD} characters.` });
		if (next !== again) return fail(400, { message: 'The two new passwords differ.' });
		if (next === current) return fail(400, { message: 'Choose a password different from the current one.' });
		await setPassword(u.id, next, false);
		// Sign out every other device, keep this one.
		await endAllSessions(u.id);
		const { token, maxAge } = await createSession(u.id, request.headers.get('user-agent'));
		cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', ...(cookies.get(FORGET_COOKIE) ? {} : { maxAge }) });
		redirect(303, '/settings');
	}
};
