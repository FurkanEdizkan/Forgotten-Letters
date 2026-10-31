import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import { campaignCreate, campaignScopeQuery } from '#lib/schemas/campaigns';

/**
 * A page of campaign cards, newest first.
 * Who: anyone signed in (mine = rights or a seat; listed = listed ones the caller is not in; deleted = the last 30 days, own as CM, all for Owners).
 * In: query ?scope=mine|listed|deleted&after=<id>&limit=<1..100, default 50>
 * Out: 200 { items: CampaignCard[], next }
 * Errors: 400 invalid, 401 unauthenticated.
 */
export const GET = api(async (event, ctx) =>
	campaigns.list(ctx, parse(campaignScopeQuery, Object.fromEntries(event.url.searchParams)))
);

/**
 * Create a campaign with its seats; the caller becomes its CM.
 * Who: Owners and Admins.
 * In: { name, kind, description?, gamesPerPlayer?, startsOn?, endsOn?, visibility, seats: 2..30, houseRules? }
 * Out: 201 { campaign, seats }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden for Users or other site, 409 conflict name taken.
 */
export const POST = api(async (event, ctx) =>
	json(await campaigns.create(ctx, await body(event, campaignCreate)), { status: 201 })
);
