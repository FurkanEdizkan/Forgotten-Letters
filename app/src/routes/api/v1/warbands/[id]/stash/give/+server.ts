import { api, body, parse } from '#lib/server/http';
import * as items from '#lib/server/services/warband-items';
import { giveInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Give a piece from the Arsenal to a fighter: it moves, with the fighter's checks and no money (as kit/move).
 * Who: the warband's owner.
 * In: path id; { lineId, fighterId }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) => {
	const { lineId, fighterId } = await body(event, giveInput);
	return items.move(ctx, parse(idParam, event.params).id, lineId, 'arsenal', fighterId);
});
