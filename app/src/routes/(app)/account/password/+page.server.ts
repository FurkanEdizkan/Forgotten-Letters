import { redirect } from '@sveltejs/kit';
import { formAction } from '#lib/server/http';
import { changePassword } from '#lib/server/services/auth';
import { changePasswordInput } from '#lib/schemas/auth';
import { homeFor } from '#lib/roles';
import { requireSignedIn } from '../../guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const me = requireSignedIn(event);
	if (!me.mustChangePassword) redirect(303, '/account');
};

export const actions = {
	/**
	 * Replace a temporary password after a reset; required before anything else.
	 * Who: a signed-in person whose password was reset.
	 * In: form { current (the temporary password), password }.
	 * Out: 303 to the person's own area; their other devices are signed out.
	 * Errors: 400 invalid (wrong temporary password, too common, unchanged), 401 unauthenticated.
	 */
	default: (event) =>
		formAction(event, changePasswordInput, async ({ current, password }, ctx) => {
			await changePassword(ctx, current, password);
			redirect(303, homeFor(ctx.actor!.role));
		})
} satisfies Actions;
