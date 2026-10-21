import { api, clearSessionCookie } from '#lib/server/http';
import { signOut } from '#lib/server/services/auth';

/**
 * Sign out on this device.
 * Who: any signed-in account.
 * In: nothing.
 * Out: 204 and the session cookie cleared.
 * Errors: 401 unauthenticated, 403 forbidden other site.
 */
export const POST = api(async (event, ctx) => {
	await signOut(ctx);
	clearSessionCookie(event);
	return new Response(null, { status: 204 });
});
