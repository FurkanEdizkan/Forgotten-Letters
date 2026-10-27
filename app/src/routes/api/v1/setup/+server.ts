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
 * Finish first-run setup: create the owner, save text size, accent and port, and sign the owner in.
 * Who: anyone, while no owner exists.
 * In: { username, displayName, password, textScale, accent, port }
 * Out: 201 { user, moveTo } and a session cookie; moveTo is the new address when the port moved, else null.
 * Errors: 400 invalid (field reasons: taken username, weak password, out-of-range look or port), 403 forbidden other site, 409 conflict setup already done or the port is in use, 429 rate_limited.
 */
export const POST = api(
	async (event, ctx) => {
		const { session, user, moveTo } = await completeSetup(await body(event, setupInput), ctx);
		setSessionCookie(event, session);
		return json({ user: toUser(user), moveTo }, { status: 201 });
	},
	{ auth: false }
);
