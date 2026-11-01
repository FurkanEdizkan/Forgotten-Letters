import { json } from '@sveltejs/kit';
import { api, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { campaignSeatParam } from '#lib/api-types';

/**
 * Make a lasting link for an empty seat (valid until the seat is taken or the link withdrawn); the seat's old link
 * stops working.
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
 * The seat's open link again, to copy; recorded in the audit log.
 * Who: the CM and co-CMs.
 * In: path id, seatId.
 * Out: 200 SeatLinkCopy
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found no seat or no open link, 409 conflict link made before links could be copied.
 */
export const GET = api(async (event, ctx) => {
	const { id, seatId } = parse(campaignSeatParam, event.params);
	return json(await seats.copyLink(ctx, id, seatId));
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
