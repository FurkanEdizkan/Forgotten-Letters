import { json } from '@sveltejs/kit';
import { api, body, setSessionCookie } from '#lib/server/http';
import { signIn } from '#lib/server/services/auth';
import { signInInput } from '#lib/schemas/auth';
import { toUser } from '#lib/api-types';

/**
 * Sign in with username and password.
 * Who: anyone.
 * In: { username, password, remember? }
 * Out: 200 { user } and a session cookie.
 * Errors: 400 invalid, 401 unauthenticated wrong username or password, 403 forbidden other site, 429 rate_limited.
 */
export const POST = api(
	async (event, ctx) => {
		const { session, user } = await signIn(await body(event, signInInput), ctx);
		setSessionCookie(event, session);
		return json({ user: toUser(user) });
	},
	{ auth: false }
);
