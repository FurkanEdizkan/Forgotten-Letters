import { json } from '@sveltejs/kit';
import { api, body } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { warbandCreate } from '#lib/schemas/warbands';

/**
 * My warbands, by name, with rating, problems and seat.
 * Who: anyone signed in (their own).
 * In: nothing.
 * Out: 200 { items: WarbandCard[] }
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => ({ items: await warbands.listMine(ctx) }));

/**
 * Create a warband (faction, variant, Patron, name, ducat limit); from a seat it takes the campaign's rules and seat.
 * Who: anyone signed in; with campaignId, a player seated in that campaign.
 * In: { name, factionId, variantId?, patronId?, ducatLimit?, rulesSet?, rulesExpansions?, campaignId? }
 * Out: 201 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found rules or seat, 409 conflict no rules loaded or campaign ended.
 */
export const POST = api(async (event, ctx) =>
	json(await warbands.create(ctx, await body(event, warbandCreate)), { status: 201 })
);
