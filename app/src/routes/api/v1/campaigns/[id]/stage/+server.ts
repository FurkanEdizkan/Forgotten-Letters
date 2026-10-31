import { api, body, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { stageMove } from '#lib/schemas/campaigns';
import { idParam } from '#lib/api-types';

/**
 * Move the campaign to another stage (mustering and active both ways, active to ended).
 * Who: the CM and co-CMs.
 * In: path id; { to }
 * Out: 200 Campaign
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found, 409 conflict stage move not allowed.
 */
export const POST = api(async (event, ctx) =>
	campaigns.moveStage(ctx, parse(idParam, event.params).id, (await body(event, stageMove)).to)
);
