import { api, body, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { personInput } from '#lib/schemas/campaigns';
import { campaignSeatParam } from '#lib/api-types';

/**
 * Add a person by name to an empty seat; until the campaign ends.
 * Who: the CM and co-CMs.
 * In: path id, seatId; { userId }
 * Out: 200 Seat
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict seat taken, already holds a seat or campaign ended.
 */
export const POST = api(async (event, ctx) => {
	const { id, seatId } = parse(campaignSeatParam, event.params);
	return seats.assign(ctx, id, seatId, (await body(event, personInput)).userId);
});
