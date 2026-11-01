import { api, body, parse } from '#lib/server/http';
import * as holdings from '#lib/server/services/warband-stash';
import * as items from '#lib/server/services/warband-items';
import { kitLeaveQuery, lineInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * What may be bought into the Arsenal (the stash): the warband's armoury, with price and whether it may now (and why not).
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
 * One piece leaves the Arsenal: `sell` gives half its price back (rounded up, in its currency), `refund` all of it
 * (only before the warband's first game), `delete` nothing.
 * Who: the warband's owner.
 * In: path id; query ?line=<line id>&mode=sell|refund|delete (default sell)
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found not in the Arsenal, 409 conflict refund after the first game.
 */
export const DELETE = api(async (event, ctx) => {
	const { line, mode } = parse(kitLeaveQuery, Object.fromEntries(event.url.searchParams));
	return items.leave(ctx, parse(idParam, event.params).id, 'arsenal', line, mode);
});
