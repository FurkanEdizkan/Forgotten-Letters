import { api, body, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { fighterParams, lineInput, lineQuery } from '#lib/schemas/warbands';

/**
 * The armoury lines this fighter may look at, with price and whether it may take each now (and why not).
 * Who: the warband's owner; the CM and co-CMs of its campaign.
 * In: path id, fid.
 * Out: 200 { items: { lineId, itemId, name, category, price, currency, ok, reasons }[] }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return { items: await roster.armoury(ctx, id, fid) };
});

/**
 * Buy kit for the fighter from an armoury line, paid from the banks; refused with the engine's reasons.
 * Who: the warband's owner.
 * In: path id, fid; { lineId }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return roster.buy(ctx, id, fid, (await body(event, lineInput)).lineId);
});

/**
 * Sell one piece of the fighter's bought kit; its worth goes back to the banks.
 * Who: the warband's owner.
 * In: path id, fid; query ?line=<line id>
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found not carried, 409 conflict refused with its reasons.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	const { line } = parse(lineQuery, Object.fromEntries(event.url.searchParams));
	return roster.sell(ctx, id, fid, line);
});
