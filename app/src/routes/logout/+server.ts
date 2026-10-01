import { redirect } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, endSession } from '$lib/server/auth';
import { auditAuth } from '$lib/server/audit';
import { safeNext } from '$lib/server/safe-next';

export async function POST(event) {
	const { cookies, locals, url } = event;
	if (locals.user) auditAuth(event, 'signout');
	await endSession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	cookies.delete(FORGET_COOKIE, { path: '/' });
	// `next`: e.g. a player's 403 page sends "Sign in as someone else" on to the right door.
	redirect(303, safeNext(url.searchParams.get('next'), url.origin) ?? '/');
}
