import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import { homebrewParams, homebrewUpdate } from '#lib/schemas/homebrew';

/**
 * One homebrew set with its data (the rules format) and its check report, with an ETag of its version.
 * Who: its maker; anyone once it is shared; Owners.
 * In: path id.
 * Out: 200 Homebrew
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => {
	const h = await homebrew.get(ctx, parse(homebrewParams, event.params).id);
	return json(h, { headers: { etag: `"${h.version}"` } });
});

/**
 * Save the whole set with a version check; it is checked and re-indexed (a draft with problems saves with its report).
 * Who: its maker.
 * In: path id; { version, name?, data }
 * Out: 200 Homebrew
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not its maker or other site, 404 not_found, 409 conflict changed meanwhile.
 */
export const PUT = api(async (event, ctx) =>
	homebrew.update(ctx, parse(homebrewParams, event.params).id, await body(event, homebrewUpdate))
);

/**
 * Delete a homebrew set for good; refused while warbands or other sets build on it.
 * Who: its maker; Owners.
 * In: path id.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not its maker or other site, 404 not_found, 409 conflict in use.
 */
export const DELETE = api(async (event, ctx) => {
	await homebrew.remove(ctx, parse(homebrewParams, event.params).id);
	return new Response(null, { status: 204 });
});
