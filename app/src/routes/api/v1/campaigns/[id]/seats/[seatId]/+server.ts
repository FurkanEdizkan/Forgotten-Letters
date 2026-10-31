import { api, body, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { seatPatch } from '#lib/schemas/campaigns';
import { campaignSeatParam } from '#lib/api-types';

/**
 * Rename a seat and/or free it (the player leaves the seat).
 * Who: the CM and co-CMs.
 * In: path id, seatId; { version, name?, free? }
 * Out: 200 Seat
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict changed meanwhile or campaign ended.
 */
export const PATCH = api(async (event, ctx) => {
	const { id, seatId } = parse(campaignSeatParam, event.params);
	return seats.update(ctx, id, seatId, await body(event, seatPatch));
});

/**
 * Remove an empty seat; a campaign keeps at least 2.
 * Who: the CM and co-CMs.
 * In: path id, seatId.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict seat taken, too few seats or campaign ended.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, seatId } = parse(campaignSeatParam, event.params);
	await seats.remove(ctx, id, seatId);
	return new Response(null, { status: 204 });
});
