import { json } from '@sveltejs/kit';
import { api, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { campaignSeatParam } from '#lib/api-types';

/**
 * Make a one-time link for an empty seat (7 days), shown only now; the seat's open link stops working.
 * Who: the CM and co-CMs.
 * In: path id, seatId.
 * Out: 201 SeatLink
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict seat taken or joining closed.
 */
export const POST = api(async (event, ctx) => {
	const { id, seatId } = parse(campaignSeatParam, event.params);
	return json(await seats.makeLink(ctx, id, seatId), { status: 201 });
});

/**
 * Withdraw the seat's open link.
 * Who: the CM and co-CMs.
 * In: path id, seatId.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, seatId } = parse(campaignSeatParam, event.params);
	await seats.revokeLink(ctx, id, seatId);
	return new Response(null, { status: 204 });
});
