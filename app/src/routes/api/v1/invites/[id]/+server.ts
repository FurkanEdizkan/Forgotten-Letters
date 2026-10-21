import { api, parse } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import { idParam } from '#lib/api-types';

/**
 * Withdraw an invite; its link stops working.
 * Who: owners (any invite) and admins (their own).
 * In: path id.
 * Out: 204.
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found, 409 conflict already used.
 */
export const DELETE = api(async (event, ctx) => {
	await invites.revoke(ctx, parse(idParam, event.params).id);
	return new Response(null, { status: 204 });
});
