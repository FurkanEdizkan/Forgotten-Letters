import { json } from '@sveltejs/kit';
import { api, body, setSessionCookie } from '#lib/server/http';
import { completeSetup, isSetupOpen } from '#lib/server/services/setup';
import { setupInput } from '#lib/schemas/settings';
import { toUser } from '#lib/api-types';

/**
 * Whether first-run setup is open, that is, no owner exists yet.
 * Who: anyone.
 * In: nothing.
 * Out: 200 { open }
 * Errors: none.
 */
export const GET = api(async () => ({ open: await isSetupOpen() }), { auth: false });

/**
 * Finish first-run setup: create the owner, save text size and accent, and sign the owner in.
 * Who: anyone, while no owner exists.
 * In: { username, displayName, password, textScale, accent } (the port is picked when the app starts, not here)
 * Out: 201 { user } and a session cookie.
 * Errors: 400 invalid (field reasons: taken username, weak password, out-of-range look), 403 forbidden other site, 409 conflict setup already done, 429 rate_limited.
 */
export const POST = api(
	async (event, ctx) => {
		const { session, user } = await completeSetup(await body(event, setupInput), ctx);
		setSessionCookie(event, session);
		return json({ user: toUser(user) }, { status: 201 });
	},
	{ auth: false }
);
