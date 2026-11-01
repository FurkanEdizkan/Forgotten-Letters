import { api, body, parse } from '#lib/server/http';
import * as holdings from '#lib/server/services/warband-stash';
import { lineInput, lineQuery } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * What may be bought into the stash: the warband's armoury, with price and whether it may now (and why not).
 * Who: the warband's owner; the CM and co-CMs of its campaign.
 * In: path id.
 * Out: 200 { items: { lineId, itemId, name, category, price, currency, ok, reasons }[] }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => ({
	items: await holdings.stashLines(ctx, parse(idParam, event.params).id)
}));

/**
 * Buy kit into the stash, paid from the banks; refused with the engine's reasons.
 * Who: the warband's owner.
 * In: path id; { lineId }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) =>
	holdings.stashBuy(ctx, parse(idParam, event.params).id, (await body(event, lineInput)).lineId)
);

/**
 * Sell one piece from the stash; its price goes back to the banks.
 * Who: the warband's owner.
 * In: path id; query ?line=<line id>
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found not in the stash.
 */
export const DELETE = api(async (event, ctx) => {
	const { line } = parse(lineQuery, Object.fromEntries(event.url.searchParams));
	return holdings.stashSell(ctx, parse(idParam, event.params).id, line);
});
