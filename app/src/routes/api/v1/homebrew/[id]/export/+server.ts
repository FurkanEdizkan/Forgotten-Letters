import { api, parse } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import { homebrewParams } from '#lib/schemas/homebrew';

/**
 * The set as one JSON object of its rules folder's files (manifest.json, units.json, …), as a file to save.
 * Who: anyone who may see it.
 * In: path id.
 * Out: 200 application/json, with a file name.
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => {
	const out = await homebrew.exportOf(ctx, parse(homebrewParams, event.params).id);
	const file = `${out.name.replace(/[^\w .-]+/g, '').trim() || 'homebrew'}.json`;
	return new Response(out.body, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${file}"`
		}
	});
});
