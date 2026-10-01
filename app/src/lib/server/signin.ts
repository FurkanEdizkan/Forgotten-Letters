import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, authenticate, createSession, loginLimiter, sessionCookie } from './auth';
import { normaliseUsername } from './passwords';
import { safeNext } from './safe-next';
import { auditAuth, clientAddress, clientMeta } from './audit';
import { accessMode, landingFor } from './access';
import { env } from '$env/dynamic/private';

/**
 * Signing in, at one of two doors:
 * - `players` (/login): every account but the Campaign Master's. Limited per address and per username.
 * - `cm` (/admin/login): only the Campaign Master. Limited per address only, so no one can lock the CM out by
 *   guessing at their username; guessing from many addresses is left to the .env password's strength.
 * An account at the wrong door gets the same answer as a wrong password.
 */
export async function signIn(event: RequestEvent, door: 'players' | 'cm') {
	const { request, cookies, url } = event;
	const data = await request.formData();
	const username = normaliseUsername(String(data.get('username') ?? '')).slice(0, 32);
	const password = String(data.get('password') ?? '').slice(0, 200);
	const ip = clientAddress(event);
	const allowed =
		door === 'cm'
			? await loginLimiter.take(`cm-ip:${ip}`)
			: (await loginLimiter.take(`ip:${ip}`)) && (await loginLimiter.take(`user:${username}`));
	if (!allowed) {
		auditAuth(event, 'signin.limited', { detail: { username, door } });
		return fail(429, { tab: 'signin' as const, username, message: 'Too many attempts. Wait a minute and try again.' });
	}
	const found = await authenticate(username, password);
	const u = found && (found.role === 'cm') === (door === 'cm') ? found : null;
	if (!u) {
		auditAuth(event, 'signin.fail', { detail: { username, door, ...(found ? { wrongDoor: true } : {}) } });
		return fail(401, { tab: 'signin' as const, username, message: 'That username and password do not match, or the account is disabled.' });
	}
	if (door === 'players') await loginLimiter.clear(`user:${username}`);
	const { token } = await createSession(u.id, clientMeta(event));
	auditAuth(event, 'signin.ok', { actorId: u.id, actorName: u.username });
	// "Remember me": a cookie that lasts the session's 30 days; otherwise one that ends when the browser closes.
	const remember = data.has('remember');
	const secure = url.protocol === 'https:';
	cookies.set(SESSION_COOKIE, token, sessionCookie(secure, remember));
	if (remember) cookies.delete(FORGET_COOKIE, { path: '/' });
	else cookies.set(FORGET_COOKIE, '1', sessionCookie(secure, false));
	redirect(303, landingFor(accessMode(env.ACCESS), u, safeNext(url.searchParams.get('next'), url.origin)));
}
