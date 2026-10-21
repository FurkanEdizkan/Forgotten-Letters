/** "/" sends people where they belong: their own area when signed in, else the sign-in page. */
import { redirect } from '@sveltejs/kit';
import { homeFor } from '#lib/roles';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	redirect(303, locals.user ? homeFor(locals.user.role) : '/login');
};
