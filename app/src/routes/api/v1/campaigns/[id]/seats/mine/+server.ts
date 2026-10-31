import { api, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { idParam } from '#lib/api-types';

/**
 * Leave one's own seat.
 * Who: a player in the campaign; mustering only.
 * In: path id.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found no seat, 409 conflict not mustering.
 */
export const DELETE = api(async (event, ctx) => {
	await seats.leave(ctx, parse(idParam, event.params).id);
	return new Response(null, { status: 204 });
});
