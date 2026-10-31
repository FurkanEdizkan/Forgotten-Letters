import { api, body, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { personInput } from '#lib/schemas/campaigns';
import { idParam } from '#lib/api-types';

/**
 * Hand the CM role to a co-CM; the old CM becomes a co-CM.
 * Who: the CM, and Owners.
 * In: path id; { userId }
 * Out: 200 { members: CampaignMember[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict not a co-CM.
 */
export const POST = api(async (event, ctx) => {
	const c = await campaigns.transfer(
		ctx,
		parse(idParam, event.params).id,
		(await body(event, personInput)).userId
	);
	return { members: c.members };
});
