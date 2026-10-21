import { api, body } from '#lib/server/http';
import { requireUser, setDisplayName } from '#lib/server/services/auth';
import { displayNameInput } from '#lib/schemas/auth';
import { areasFor } from '#lib/roles';
import { toUser } from '#lib/api-types';

/**
 * The signed-in account and the areas it may use.
 * Who: any signed-in account.
 * In: nothing.
 * Out: 200 { user, areas }
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => {
	const me = requireUser(ctx);
	return { user: toUser(me), areas: areasFor(me.role) };
});

/**
 * Change the display name.
 * Who: any signed-in account, for itself.
 * In: { displayName }
 * Out: 200 { user }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site.
 */
export const PATCH = api(async (event, ctx) => {
	const { displayName } = await body(event, displayNameInput);
	await setDisplayName(ctx, displayName);
	return { user: toUser({ ...requireUser(ctx), displayName }) };
});
