/**
 * "/" sends people where they belong: the welcome page while setup is open, their own area when signed in, else the
 * sign-in page.
 */
import { redirect } from '@sveltejs/kit';
import { homeFor } from '#lib/roles';
import { isSetupOpen } from '#lib/server/services/setup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (await isSetupOpen()) redirect(303, '/welcome');
	redirect(303, locals.user ? homeFor(locals.user.role) : '/login');
};
