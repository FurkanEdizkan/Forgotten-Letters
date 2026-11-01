import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { warbandPatch } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * One warband with its fighters, costs, rating, problems and seat, with an ETag of its version.
 * Who: its owner; the CM and co-CMs of the campaign it sits in (read-only).
 * In: path id.
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found, 409 conflict its faction is not in its rules.
 */
export const GET = api(async (event, ctx) => {
	const w = await warbands.get(ctx, parse(idParam, event.params).id);
	return json(w, { headers: { etag: `"${w.version}"` } });
});

/**
 * Change the warband's name, Patron, dedication, ducat limit, banks or notes, with a version check.
 * Who: its owner.
 * In: path id; { version, name?, patronId?, dedication?, ducatLimit?, stashDucats?, unspentGlory?, notes? }
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict changed meanwhile or the engine refuses it.
 */
export const PATCH = api(async (event, ctx) =>
	warbands.patch(ctx, parse(idParam, event.params).id, await body(event, warbandPatch))
);

/**
 * Delete a warband for good; it leaves its seat, its fighters and images go too.
 * Who: its owner.
 * In: path id.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found.
 */
export const DELETE = api(async (event, ctx) => {
	await warbands.remove(ctx, parse(idParam, event.params).id);
	return new Response(null, { status: 204 });
});
