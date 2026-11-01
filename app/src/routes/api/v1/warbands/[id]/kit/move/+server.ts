import { api, body, parse } from '#lib/server/http';
import * as items from '#lib/server/services/warband-items';
import { moveInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Move one piece of bought kit between fighters and the Arsenal; no money changes hands. A fighter that takes it is
 * checked as for buying it, except for money.
 * Who: the warband's owner.
 * In: path id; { lineId, from: fighter id | 'arsenal', to: fighter id | 'arsenal' }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found not held there, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) => {
	const { lineId, from, to } = await body(event, moveInput);
	return items.move(ctx, parse(idParam, event.params).id, lineId, from, to);
});
