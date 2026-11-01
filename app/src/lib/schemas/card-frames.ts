/**
 * Fighter cards and their frames (step 4 revision 3): the card's size, which the browser draws and a frame must
 * match exactly, and the card-frames API's inputs and answers. Shared by the API, the Owner's page, the card drawing
 * and the OpenAPI document.
 */
import { z } from 'zod';

/** The card is 4:5 (review decision D1), drawn at this size and saved as a PNG of it. */
export const CARD_WIDTH = 800;
export const CARD_HEIGHT = 1000;

/** A faction, variant or Sin id as the rules folders spell them. */
export const frameTarget = z
	.string()
	.min(1)
	.max(200)
	.regex(/^(faction|variant):[a-z0-9][a-z0-9:/#._-]*$/, 'Use a faction or variant id.');

export const cardFrameOut = z.object({
	target: z.string(),
	/** Where the browser fetches the PNG; changes when the frame is replaced. */
	url: z.string(),
	version: z.number().int(),
	updatedAt: z.string()
});
export type CardFrameOut = z.infer<typeof cardFrameOut>;

export const cardFramesOut = z.object({ items: z.array(cardFrameOut) });

/** One row of the Owner's frames page. */
export const frameTargetOut = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(['faction', 'variant', 'sin']),
	/** The faction a variant or Sin belongs to; null for a faction. */
	faction: z.string().nullable(),
	frame: cardFrameOut.nullable()
});
export type FrameTargetOut = z.infer<typeof frameTargetOut>;

/** The Owner's upload form: which target and the file. */
export const frameUpload = z.object({
	target: frameTarget,
	image: z.instanceof(Blob, { message: 'Pick a PNG file.' })
});
export const frameRemove = z.object({ target: frameTarget });
