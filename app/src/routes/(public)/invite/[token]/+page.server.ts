import { redirect } from '@sveltejs/kit';
import { formAction, setSessionCookie } from '#lib/server/http';
import { accept, preview } from '#lib/server/services/invites';
import { newAccountInput } from '#lib/schemas/auth';
import { homeFor } from '#lib/roles';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => ({ invite: await preview(params.token) });

export const actions = {
	/**
	 * Accept an invite: create the account with the invite's role and sign it in.
	 * Who: anyone holding the invite link.
	 * In: form { username, displayName, password }.
	 * Out: 303 to the new account's area with a browser-session cookie.
	 * Errors: 400 invalid (taken username, common password), 404 not_found unknown or withdrawn invite, 409 conflict used or expired.
	 */
	default: (event) =>
		formAction(event, newAccountInput, async (input, ctx) => {
			const { session, user } = await accept(event.params.token, input, ctx);
			setSessionCookie(event, session);
			redirect(303, homeFor(user.role));
		})
} satisfies Actions;
