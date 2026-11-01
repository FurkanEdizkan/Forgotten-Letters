import { api, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { idParam } from '#lib/api-types';

/**
 * Every seat's warband in the campaign: name, faction, rating, problems.
 * Who: the CM and co-CMs.
 * In: path id.
 * Out: 200 { items: { seatId, seatName, warband: WarbandCard }[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not CM or co-CM, 404 not_found.
 */
export const GET = api(async (event, ctx) => ({
	items: await warbands.ofCampaign(ctx, parse(idParam, event.params).id)
}));
