import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { seatCount } from '#lib/schemas/campaigns';
import { idParam } from '#lib/api-types';

/**
 * The seats in number order; people outside the campaign see no players.
 * Who: anyone who may see the campaign.
 * In: path id.
 * Out: 200 { items: Seat[] }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => ({
	items: await seats.list(ctx, parse(idParam, event.params).id)
}));

/**
 * Add seats; a campaign has 30 at most.
 * Who: the CM and co-CMs.
 * In: path id; { count }
 * Out: 201 { items: Seat[] } (the new seats)
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict 30 seats at most or campaign ended.
 */
export const POST = api(async (event, ctx) => {
	const { count } = await body(event, seatCount);
	return json(
		{ items: await seats.add(ctx, parse(idParam, event.params).id, count) },
		{ status: 201 }
	);
});
