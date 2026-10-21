import { json } from '@sveltejs/kit';
import { api, body, parse, setSessionCookie } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import { newAccountInput } from '#lib/schemas/auth';
import { tokenParam, toUser } from '#lib/api-types';

/**
 * Accept an invite: create the account and sign it in.
 * Who: anyone holding the invite link.
 * In: path token; { username, displayName, password }
 * Out: 201 { user } and a session cookie.
 * Errors: 400 invalid username taken or weak password, 403 forbidden other site, 404 not_found unknown or withdrawn invite, 409 conflict used or expired.
 */
export const POST = api(
	async (event, ctx) => {
		const { token } = parse(tokenParam, event.params);
		const { session, user } = await invites.accept(token, await body(event, newAccountInput), ctx);
		setSessionCookie(event, session);
		return json({ user: toUser(user) }, { status: 201 });
	},
	{ auth: false }
);
