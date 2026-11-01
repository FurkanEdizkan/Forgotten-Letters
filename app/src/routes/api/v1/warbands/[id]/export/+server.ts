import { api, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { exportQuery } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * The warband as Trench Companion text (its Full layout) or as our own JSON, as a file to save.
 * Who: its owner; the CM and co-CMs of the campaign it sits in.
 * In: path id; query ?format=text|json (default text).
 * Out: 200 text/plain or application/json, with a file name.
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found.
 */
export const GET = api(async (event, ctx) => {
	const { format } = parse(exportQuery, Object.fromEntries(event.url.searchParams));
	const out = await warbands.exportOf(ctx, parse(idParam, event.params).id, format);
	const file = `${out.name.replace(/[^\w .-]+/g, '').trim() || 'warband'}.${out.ext}`;
	return new Response(out.body, {
		headers: {
			'content-type': `${out.type}; charset=utf-8`,
			'content-disposition': `attachment; filename="${file}"`
		}
	});
});
