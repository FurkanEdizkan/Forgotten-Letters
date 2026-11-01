import { api, body, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { copyInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Copy a warband: same rules, faction, banks, fighters (without images), Arsenal, fireteams, locations and notes,
 * as a new warband of the caller's in no seat.
 * Who: the warband's owner.
 * In: path id; { name? } (default: "<name> (copy)")
 * Out: 200 Warband (the copy)
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner, 404 not_found.
 */
export const POST = api(async (event, ctx) =>
	warbands.copy(ctx, parse(idParam, event.params).id, (await body(event, copyInput)).name)
);
