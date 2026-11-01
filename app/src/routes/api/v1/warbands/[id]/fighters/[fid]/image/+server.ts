import { api, parse } from '#lib/server/http';
import * as images from '#lib/server/services/fighter-images';
import { fighterParams } from '#lib/schemas/warbands';

/**
 * Upload the fighter's image as the raw body, or as the field `image` of a multipart form; stored as sent.
 * Who: the warband's owner.
 * In: path id, fid; body: a PNG, JPEG or WebP file of 2 MB at most (checked by its signature).
 * Out: 200 Warband
 * Errors: 400 invalid wrong type or too large, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found.
 */
export const PUT = api(
	async (event, ctx) => {
		const { id, fid } = parse(fighterParams, event.params);
		const multipart = event.request.headers.get('content-type')?.startsWith('multipart/form-data');
		const file = multipart ? (await event.request.formData()).get('image') : null;
		const bytes = await images.readLimited(
			multipart ? (file instanceof Blob ? file : null) : event.request.body
		);
		return images.setImage(ctx, id, fid, bytes);
	},
	{ upload: true }
);

/**
 * Remove the fighter's image; the slot is empty again.
 * Who: the warband's owner.
 * In: path id, fid.
 * Out: 200 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found.
 */
export const DELETE = api(async (event, ctx) => {
	const { id, fid } = parse(fighterParams, event.params);
	return images.clearImage(ctx, id, fid);
});
