import { api } from '#lib/server/http';
import { signOutEverywhere } from '#lib/server/services/auth';

/**
 * Sign out every other device; this one stays signed in.
 * Who: any signed-in account.
 * In: nothing.
 * Out: 204.
 * Errors: 401 unauthenticated, 403 forbidden other site.
 */
export const POST = api(async (_event, ctx) => {
	await signOutEverywhere(ctx);
	return new Response(null, { status: 204 });
});
