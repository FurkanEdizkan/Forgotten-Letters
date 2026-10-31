import { json } from '@sveltejs/kit';
import { api, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { idParam } from '#lib/api-types';

/**
 * Make a fresh one-time link for every empty seat, shown only now; their old links stop working.
 * Who: the CM and co-CMs.
 * In: path id.
 * Out: 201 { links: SeatLink[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict joining closed.
 */
export const POST = api(async (event, ctx) =>
	json({ links: await seats.makeAllLinks(ctx, parse(idParam, event.params).id) }, { status: 201 })
);
