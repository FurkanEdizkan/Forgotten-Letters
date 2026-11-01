import { api, body, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import * as items from '#lib/server/services/warband-items';
import { fighterParams, kitLeaveQuery, lineInput } from '#lib/schemas/warbands';

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
 * One piece of the fighter's bought kit leaves: `sell` gives half its price back (rounded up, in its currency),
 * `refund` all of it (only before the warband's first game), `delete` nothing.
 * Who: the warband's owner.
 * In: path id, fid; query ?line=<line id>&mode=sell|refund|delete (default sell)
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found not carried, 409 conflict refused with its reasons or refund after the first game.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	const { line, mode } = parse(kitLeaveQuery, Object.fromEntries(event.url.searchParams));
	return items.leave(ctx, id, fid, line, mode);
});
