import { redirect } from '@sveltejs/kit';
import { formAction, setSessionCookie } from '#lib/server/http';
import { signIn } from '#lib/server/services/auth';
import { signInInput } from '#lib/schemas/auth';
import { homeFor } from '#lib/roles';
import type { Actions, PageServerLoad } from './$types';

/** A local path to return to after signing in, or null (never another site). */
const safeNext = (next: string | null) =>
	next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user)
		redirect(303, safeNext(url.searchParams.get('next')) ?? homeFor(locals.user.role));
};

export const actions = {
	/**
	 * Sign in with username and password; one form for every role.
	 * Who: anyone not signed in.
	 * In: form { username, password, remember? }; query ?next= a local path to return to.
	 * Out: 303 to `next` or the person's own area, with a session cookie (30 days with remember, else browser session).
	 * Errors: 400 invalid, 401 unauthenticated wrong username or password, 429 rate_limited.
	 */
	default: (event) =>
		formAction(event, signInInput, async (input, ctx) => {
			const { session, user } = await signIn(input, ctx);
			setSessionCookie(event, session);
			redirect(303, safeNext(event.url.searchParams.get('next')) ?? homeFor(user.role));
		})
} satisfies Actions;
