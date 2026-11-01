import { api, body, parse } from '#lib/server/http';
import * as holdings from '#lib/server/services/warband-stash';
import { locationsInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Replace the locations the warband holds, each a name and a note.
 * Who: the warband's owner.
 * In: path id; { locations: { name, note? }[] }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found.
 */
export const PUT = api(async (event, ctx) =>
	holdings.setLocations(
		ctx,
		parse(idParam, event.params).id,
		(await body(event, locationsInput)).locations
	)
);
