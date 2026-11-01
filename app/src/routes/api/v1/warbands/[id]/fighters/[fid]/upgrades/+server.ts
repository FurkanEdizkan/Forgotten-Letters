import { api, body, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { fighterParams, upgradeInput, upgradeQuery } from '#lib/schemas/warbands';

/**
 * The upgrades this fighter's entry may take, with price, whether it has each, and whether it may take it now.
 * Who: the warband's owner; the CM and co-CMs of its campaign.
 * In: path id, fid.
 * Out: 200 { items: { upgradeId, name, cost, currency, has, ok, reasons }[] }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return { items: await roster.upgradesFor(ctx, id, fid) };
});

/**
 * Give the fighter an upgrade, paid from the banks; refused with the engine's reasons.
 * Who: the warband's owner.
 * In: path id, fid; { upgradeId }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return roster.upgrade(ctx, id, fid, (await body(event, upgradeInput)).upgradeId);
});

/**
 * Take an upgrade off the fighter; its worth goes back to the banks.
 * Who: the warband's owner.
 * In: path id, fid; query ?upgrade=<upgrade id>
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	const { upgrade } = parse(upgradeQuery, Object.fromEntries(event.url.searchParams));
	return roster.removeUpgrade(ctx, id, fid, upgrade);
});
