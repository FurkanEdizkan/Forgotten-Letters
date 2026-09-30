import { redirect } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, endSession } from '$lib/server/auth';
import { auditAuth } from '$lib/server/audit';

export async function POST(event) {
	const { cookies, locals } = event;
	if (locals.user) auditAuth(event, 'signout');
	await endSession(cookies.get(SESSION_COOKIE));
	cookies.delete(SESSION_COOKIE, { path: '/' });
	cookies.delete(FORGET_COOKIE, { path: '/' });
	redirect(303, '/');
}
