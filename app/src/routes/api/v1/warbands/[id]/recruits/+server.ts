import { api, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { idParam } from '#lib/api-types';

/**
 * Every entry the warband could recruit, with its price and whether it may now (and why not).
 * Who: its owner; the CM and co-CMs of the campaign it sits in.
 * In: path id.
 * Out: 200 { items: { unitId, name, category, cost, currency, ok, reasons }[] }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => ({
	items: await roster.recruits(ctx, parse(idParam, event.params).id)
}));
