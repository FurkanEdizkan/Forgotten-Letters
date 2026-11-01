import { api, body, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { fighterParams, fighterPatch } from '#lib/schemas/warbands';

/**
 * Edit a fighter: name, group (Dead included), Experience, skills and injuries (ids or names), with its version.
 * Who: the warband's owner.
 * In: path id, fid; { version, name?, group?, xp?, skills?, injuries? }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict changed meanwhile or refused with its reasons.
 */
export const PATCH = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return roster.editFighter(ctx, id, fid, await body(event, fighterPatch));
});

/**
 * Remove a fighter: its worth goes back to the banks, it leaves its fireteam, its image goes.
 * Who: the warband's owner.
 * In: path id, fid.
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return roster.removeFighter(ctx, id, fid);
});
