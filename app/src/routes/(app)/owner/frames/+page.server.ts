import { ctxOf, formAction } from '#lib/server/http';
import * as frames from '#lib/server/services/card-frames';
import { readLimited } from '#lib/server/services/image-files';
import { frameRemove, frameUpload } from '#lib/schemas/card-frames';
import type { Actions, PageServerLoad } from './$types';

// The owner layout guards the page; the actions rely on the service's own owner check.
export const load: PageServerLoad = async (event) => ({
	targets: await frames.targets(ctxOf(event))
});

export const actions = {
	/**
	 * Give a faction, variant or Sin its card frame, replacing any.
	 * Who: owners.
	 * In: form { target, image } a PNG of exactly 800×1000, 2 MB at most.
	 * Out: { op: 'upload', id } the target.
	 * Errors: 400 invalid not a PNG, wrong size or too large, 401 unauthenticated, 403 forbidden not an owner, 404 not_found no such faction or variant loaded.
	 */
	upload: (event) =>
		formAction(event, frameUpload, async (input, ctx) => {
			await frames.setFrame(ctx, input.target, await readLimited(input.image));
			return { op: 'upload' as const, id: input.target };
		}),

	/**
	 * Remove a frame: the cards use the faction's frame, or the built-in one.
	 * Who: owners.
	 * In: form { target }.
	 * Out: { op: 'remove', id } the target.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not an owner, 404 not_found it has no frame.
	 */
	remove: (event) =>
		formAction(event, frameRemove, async (input, ctx) => {
			await frames.clearFrame(ctx, input.target);
			return { op: 'remove' as const, id: input.target };
		})
} satisfies Actions;
