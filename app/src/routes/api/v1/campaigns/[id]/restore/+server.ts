import { api, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { idParam } from '#lib/api-types';

/**
 * Restore a deleted campaign within 30 days.
 * Who: its CM and Owners.
 * In: path id.
 * Out: 200 Campaign
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden or other site, 404 not_found unknown or purged, 409 conflict name taken or not deleted.
 */
export const POST = api(async (event, ctx) =>
	campaigns.restore(ctx, parse(idParam, event.params).id)
);
