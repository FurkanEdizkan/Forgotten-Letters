import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, ctxOf } from '#lib/server/http';
import { signOut } from '#lib/server/services/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions = {
	/**
	 * Sign out of this device.
	 * Who: anyone; a visitor without a session is simply sent to sign in.
	 * In: nothing.
	 * Out: 303 to /login, the session ended and its cookie cleared.
	 * Errors: none.
	 */
	default: async (event) => {
		await signOut(ctxOf(event));
		clearSessionCookie(event);
		redirect(303, '/login');
	}
} satisfies Actions;
