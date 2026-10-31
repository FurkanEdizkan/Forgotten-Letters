import { api, body, parse } from '#lib/server/http';
import * as requests from '#lib/server/services/join-requests';
import { approveInput } from '#lib/schemas/campaigns';
import { campaignRequestParam } from '#lib/api-types';

/**
 * Approve a request into an empty seat.
 * Who: the CM and co-CMs; mustering only.
 * In: path id, rid; { seatId }
 * Out: 200 Seat
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict seat taken, request already decided or not mustering.
 */
export const POST = api(async (event, ctx) => {
	const { id, rid } = parse(campaignRequestParam, event.params);
	return requests.approve(ctx, id, rid, (await body(event, approveInput)).seatId);
});
