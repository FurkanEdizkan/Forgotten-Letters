import { redirect } from '@sveltejs/kit';
import { formAction, setSessionCookie } from '#lib/server/http';
import { completeSetup } from '#lib/server/services/setup';
import { getSettings } from '#lib/server/services/settings';
import { setupInput } from '#lib/schemas/settings';
import type { Actions, PageServerLoad } from './$types';

// The hook sends this page to /login once an Owner exists, so load only needs the settings the wizard starts from.
export const load: PageServerLoad = async ({ url }) => {
	const s = await getSettings(url.host);
	return {
		textScale: s.textScale,
		accent: s.accent,
		port: s.port,
		portLocked: s.portLocked,
		address: s.address
	};
};

export const actions = {
	/**
	 * Finish the first-run wizard: create the Owner, save the look and the port, and sign the Owner in.
	 * Who: anyone, while no Owner exists (open setup, Jellyfin style).
	 * In: form setupInput { username, displayName, password, textScale, accent, port } (the wizard's four steps).
	 * Out: 303 to the new address when the port moves, else to /owner, with a remembered session cookie.
	 * Errors: 400 invalid with field reasons (a taken username sends the wizard back to step 1), 409 conflict when an
	 * Owner already exists or the port cannot be opened (reason on the port field), 429 rate_limited.
	 */
	finish: (event) =>
		formAction(event, setupInput, async (input, ctx) => {
			const { session, moveTo } = await completeSetup(input, ctx);
			setSessionCookie(event, session);
			redirect(303, moveTo ?? '/owner');
		})
} satisfies Actions;
