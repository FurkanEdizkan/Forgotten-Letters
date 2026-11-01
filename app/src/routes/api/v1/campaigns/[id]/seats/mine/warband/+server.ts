import { api, body, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { assignInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Put one of my warbands in my seat (replacing the one there); recheck moves it to the campaign's rules first.
 * Who: a player seated in the campaign, until it ends.
 * In: path id; { warbandId, recheck? }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not my warband or other site, 404 not_found no seat or warband, 409 conflict in another campaign, other rules, refused with its reasons or campaign ended.
 */
export const PUT = api(async (event, ctx) =>
	warbands.assignToSeat(ctx, parse(idParam, event.params).id, await body(event, assignInput))
);

/**
 * Take my warband out of my seat; the seat stays mine.
 * Who: a player seated in the campaign, until it ends.
 * In: path id.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found no seat, 409 conflict campaign ended.
 */
export const DELETE = api(async (event, ctx) => {
	await warbands.clearSeat(ctx, parse(idParam, event.params).id);
	return new Response(null, { status: 204 });
});
