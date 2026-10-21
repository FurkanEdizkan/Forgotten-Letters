import { api, body } from '#lib/server/http';
import { changePassword } from '#lib/server/services/auth';
import { changePasswordInput } from '#lib/schemas/auth';

/**
 * Change the password; every other device is signed out.
 * Who: any signed-in account, for itself.
 * In: { current, password }
 * Out: 204.
 * Errors: 400 invalid wrong current, common or unchanged password, 401 unauthenticated, 403 forbidden other site.
 */
export const POST = api(async (event, ctx) => {
	const { current, password } = await body(event, changePasswordInput);
	await changePassword(ctx, current, password);
	return new Response(null, { status: 204 });
});
