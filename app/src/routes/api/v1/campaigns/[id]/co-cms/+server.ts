import { api, body, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { personInput } from '#lib/schemas/campaigns';
import { idParam } from '#lib/api-types';

/**
 * Give an active Admin or Owner co-CM rights.
 * Who: the CM.
 * In: path id; { userId }
 * Out: 200 { members: CampaignMember[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the CM or other site, 404 not_found, 409 conflict not an active Admin or Owner, or already has rights.
 */
export const POST = api(async (event, ctx) => {
	const c = await campaigns.addCoCm(
		ctx,
		parse(idParam, event.params).id,
		(await body(event, personInput)).userId
	);
	return { members: c.members };
});
