import { error, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { ctxOf } from '#lib/server/http';
import { AppError, ERROR_STATUS } from '#lib/server/errors';
import * as images from '#lib/server/services/fighter-images';

const params = z.object({ id: z.uuid() });

/**
 * A fighter's image, with its stored content type. The address carries the fighter's version (?v=), so a browser
 * may keep it; it is private, never shared caches.
 * Who: the warband's owner; the CM and co-CMs of the campaign it sits in.
 * In: path id (the fighter).
 * Out: 200 image/png, image/jpeg or image/webp.
 * Errors: 401 unauthenticated, 404 not_found no image or not visible.
 */
export const GET: RequestHandler = async (event) => {
	const p = params.safeParse(event.params);
	if (!event.locals.user || !p.success)
		error(event.locals.user ? 404 : 401, {
			message: 'No such image.',
			requestId: event.locals.requestId
		});
	try {
		const img = await images.image(ctxOf(event), p.data.id);
		return new Response(new Uint8Array(img.bytes), {
			headers: {
				'content-type': img.type,
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
