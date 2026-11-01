import { error, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { ctxOf } from '#lib/server/http';
import { AppError, ERROR_STATUS } from '#lib/server/errors';
import * as frames from '#lib/server/services/card-frames';

const params = z.object({ id: z.uuid() });

/**
 * A fighter-card frame (PNG). The address carries the frame's version (?v=), so a browser may keep it; it is
 * private, never shared caches.
 * Who: anyone signed in.
 * In: path id (the frame).
 * Out: 200 image/png.
 * Errors: 401 unauthenticated, 404 not_found no such frame.
 */
export const GET: RequestHandler = async (event) => {
	const p = params.safeParse(event.params);
	if (!event.locals.user || !p.success)
		error(event.locals.user ? 404 : 401, {
			message: 'No such frame.',
			requestId: event.locals.requestId
		});
	try {
		const img = await frames.frameFile(ctxOf(event), p.data.id);
		return new Response(new Uint8Array(img.bytes), {
			headers: {
				'content-type': 'image/png',
				'cache-control': 'private, max-age=31536000, immutable',
				'content-security-policy': "default-src 'none'"
			}
		});
	} catch (e) {
		if (e instanceof AppError)
			error(ERROR_STATUS[e.code], { message: e.message, requestId: event.locals.requestId });
		throw e;
	}
};
