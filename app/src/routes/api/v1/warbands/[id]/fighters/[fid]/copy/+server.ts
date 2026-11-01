import { api, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { fighterParams } from '#lib/schemas/warbands';

/**
 * Copy a fighter: the same entry, upgrades and bought kit (no name, skills, injuries or Experience), recruited and
 * paid for whole from the banks, with every recruit check.
 * Who: the warband's owner.
 * In: path id, fid.
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return roster.copyFighter(ctx, id, fid);
});
