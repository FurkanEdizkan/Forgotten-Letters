import { api, body, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { fighterLeaveQuery, fighterParams, fighterPatch } from '#lib/schemas/warbands';

/**
 * Edit a fighter: name, rank (group: Elites promotes a Troop, Troops demotes it), status, Experience, Battle
 * Scars, skills (advancements) and injuries (ids or names), with its version. Unfit for duty puts its bought kit in
 * the Arsenal; promotion and Limited Potential follow the book.
 * Who: the warband's owner.
 * In: path id, fid; { version, name?, group?, status?, xp?, scars?, skills?, injuries? }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict changed meanwhile or refused with its reasons.
 */
export const PATCH = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return roster.editFighter(ctx, id, fid, await body(event, fighterPatch));
});

/**
 * Remove a fighter: `refund` gives back what it was worth (only before the warband's first game), `delete` gives
 * nothing back; it leaves its fireteam, its image goes.
 * Who: the warband's owner.
 * In: path id, fid; query ?mode=refund|delete (default delete)
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons or refund after the first game.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	const { mode } = parse(fighterLeaveQuery, Object.fromEntries(event.url.searchParams));
	return roster.removeFighter(ctx, id, fid, mode);
});
