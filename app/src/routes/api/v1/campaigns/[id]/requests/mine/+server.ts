import { api, parse } from '#lib/server/http';
import * as requests from '#lib/server/services/join-requests';
import { idParam } from '#lib/api-types';

/**
 * Withdraw one's own open request to join.
 * Who: the person who asked.
 * In: path id.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found no open request.
 */
export const DELETE = api(async (event, ctx) => {
	await requests.withdraw(ctx, parse(idParam, event.params).id);
	return new Response(null, { status: 204 });
});
