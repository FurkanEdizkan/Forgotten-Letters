import { api, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { campaignUserParam } from '#lib/api-types';

/**
 * Take co-CM rights away.
 * Who: the CM.
 * In: path id, userId.
 * Out: 200 { members: CampaignMember[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the CM or other site, 404 not_found not a co-CM.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, userId } = parse(campaignUserParam, event.params);
	return { members: (await campaigns.removeCoCm(ctx, id, userId)).members };
});
