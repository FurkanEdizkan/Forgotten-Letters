import { Readable } from 'node:stream';
import { api } from '#lib/server/http';
import * as backups from '#lib/server/services/backups';
import type { RequestHandler } from './$types';

/**
 * Download one backup file (audited).
 * Who: owners.
 * In: path name, a backup file name from the list.
 * Out: 200 the dump as application/octet-stream, as an attachment.
 * Errors: 401 unauthenticated, 403 forbidden, 404 not_found no such backup.
 */
export const GET: RequestHandler = api(async (event, ctx) => {
	const file = await backups.open(ctx, event.params.name ?? '');
	return new Response(Readable.toWeb(file.stream) as ReadableStream, {
		headers: {
			'content-type': 'application/octet-stream',
			'content-length': String(file.size),
			'content-disposition': `attachment; filename="${file.name}"`
		}
	});
});
