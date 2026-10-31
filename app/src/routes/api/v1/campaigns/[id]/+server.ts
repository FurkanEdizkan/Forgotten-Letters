import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { campaignPatch } from '#lib/schemas/campaigns';
import { idParam } from '#lib/api-types';

/**
 * One campaign, with an ETag of its version.
 * Who: its CM, co-CMs and players; anyone signed in if it is listed; while deleted, its CM and Owners.
 * In: path id.
 * Out: 200 { campaign, myRole, seatsTaken }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found unknown or not visible.
 */
export const GET = api(async (event, ctx) => {
	const campaign = await campaigns.get(ctx, parse(idParam, event.params).id);
	return json(
		{ campaign, myRole: campaign.myRole, seatsTaken: campaign.seatsTaken },
		{ headers: { etag: `"${campaign.version}"` } }
	);
});

/**
 * Change the settings and house rules; the type cannot change.
 * Who: the CM and co-CMs.
 * In: path id; { name, description?, gamesPerPlayer?, startsOn?, endsOn?, visibility, houseRules?, version }
 * Out: 200 Campaign
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not CM or co-CM or other site, 404 not_found, 409 conflict changed meanwhile, name taken or campaign ended.
 */
export const PATCH = api(async (event, ctx) =>
	campaigns.update(ctx, parse(idParam, event.params).id, await body(event, campaignPatch))
);

/**
 * Delete a campaign (soft): hidden at once, restorable for 30 days.
 * Who: the CM.
 * In: path id.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the CM or other site, 404 not_found.
 */
export const DELETE = api(async (event, ctx) => {
	await campaigns.remove(ctx, parse(idParam, event.params).id);
	return new Response(null, { status: 204 });
});
