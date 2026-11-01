import { json } from '@sveltejs/kit';
import { api, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { idParam } from '#lib/api-types';

/**
 * Make a fresh lasting link for every empty seat; their old links stop working.
 * Who: the CM and co-CMs.
 * In: path id.
 * Out: 201 { links: SeatLink[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict joining closed.
 */
export const POST = api(async (event, ctx) =>
	json({ links: await seats.makeAllLinks(ctx, parse(idParam, event.params).id) }, { status: 201 })
);

/**
 * Withdraw every open seat link of the campaign at once; they stop working.
 * Who: the CM and co-CMs.
 * In: path id.
 * Out: 200 { withdrawn: number }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
 */
export const DELETE = api(async (event, ctx) => ({
	withdrawn: await seats.revokeAllLinks(ctx, parse(idParam, event.params).id)
}));
