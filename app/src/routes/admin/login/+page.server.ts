import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_COOKIE, adminToken, checkPassword } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		if (!checkPassword(password)) return fail(401, { wrong: true });

		cookies.set(ADMIN_COOKIE, adminToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 30
		});

		const next = url.searchParams.get('next');
		redirect(303, next?.startsWith('/admin') ? next : '/admin');
	}
};
