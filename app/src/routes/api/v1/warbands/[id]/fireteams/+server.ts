import { api, body, parse } from '#lib/server/http';
import * as holdings from '#lib/server/services/warband-stash';
import { fireteamsInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Replace the fireteams: pairs of fighters on the table, as many as the faction allows.
 * Who: the warband's owner.
 * In: path id; { fireteams: [fighterId, fighterId][] }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const PUT = api(async (event, ctx) =>
	holdings.setFireteams(
		ctx,
		parse(idParam, event.params).id,
		(await body(event, fireteamsInput)).fireteams
	)
);
