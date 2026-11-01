import { z } from 'zod';
import { api, parse } from '#lib/server/http';
import * as frames from '#lib/server/services/card-frames';
import { readLimited } from '#lib/server/services/image-files';
import { frameTarget } from '#lib/schemas/card-frames';

// The target is a rules id with slashes (variant:court/greed), so the path takes the rest of the URL.
const params = z.object({ target: frameTarget });

/**
 * Upload the frame of a faction, variant or Sin as the raw body, or as the field `image` of a multipart form;
 * replaces any frame it has.
 * Who: owners.
 * In: path target (a faction or variant id); body: a PNG of exactly 800×1000, 2 MB at most.
 * Out: 200 CardFrame
 * Errors: 400 invalid not a PNG, wrong size or too large, 401 unauthenticated, 403 forbidden not an owner, 404 not_found no such faction or variant loaded.
 */
export const PUT = api(
	async (event, ctx) => {
		const { target } = parse(params, event.params);
		const multipart = event.request.headers.get('content-type')?.startsWith('multipart/form-data');
		const file = multipart ? (await event.request.formData()).get('image') : null;
		const bytes = await readLimited(
			multipart ? (file instanceof Blob ? file : null) : event.request.body
		);
		return frames.setFrame(ctx, target, bytes);
	},
	{ upload: true }
);

/**
 * Remove the frame of a faction, variant or Sin: its cards use the faction's frame, or the built-in one.
 * Who: owners.
 * In: path target.
 * Out: 204
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not an owner, 404 not_found it has no frame.
 */
export const DELETE = api(async (event, ctx) => {
	const { target } = parse(params, event.params);
	await frames.clearFrame(ctx, target);
	return new Response(null, { status: 204 });
});
