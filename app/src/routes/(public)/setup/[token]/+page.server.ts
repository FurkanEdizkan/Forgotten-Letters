import { redirect } from '@sveltejs/kit';
import { formAction, setSessionCookie } from '#lib/server/http';
import { checkSetupToken, completeSetup } from '#lib/server/services/setup';
import { newAccountInput } from '#lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({
	valid: await checkSetupToken(params.token)
});

export const actions = {
	/**
	 * Create the first owner with the one-time setup link and sign them in.
	 * Who: anyone holding the setup link printed in the logs, while no owner exists.
	 * In: form { username, displayName, password }.
	 * Out: 303 to /owner with a remembered session cookie.
	 * Errors: 400 invalid (taken username, common password), 409 conflict link used or expired or an owner exists.
	 */
	default: (event) =>
		formAction(event, newAccountInput, async (input, ctx) => {
			const { session } = await completeSetup(event.params.token, input, ctx);
			setSessionCookie(event, session);
			redirect(303, '/owner');
		})
} satisfies Actions;
