import { api, parse } from '#lib/server/http';
import * as requests from '#lib/server/services/join-requests';
import { campaignRequestParam } from '#lib/api-types';

/**
 * Decline a request.
 * Who: the CM and co-CMs.
 * In: path id, rid.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict request already decided.
 */
export const POST = api(async (event, ctx) => {
	const { id, rid } = parse(campaignRequestParam, event.params);
	await requests.decline(ctx, id, rid);
	return new Response(null, { status: 204 });
});
