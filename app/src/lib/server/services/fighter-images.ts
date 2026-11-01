/**
 * Fighter image files: PNG, JPEG or WebP up to 2 MB, checked by their first bytes and kept as uploaded under
 * `<UPLOADS_DIR>/fighters/<warband id>/<fighter id>` (file handling in image-files). Who may see an image is who may
 * see its warband (warband-state).
 */
import { rm } from 'node:fs/promises';
import { AppError } from '../errors';
import { db } from '../db';
import { logger } from '../infra/logger';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import * as files from './image-files';
import { MAX_IMAGE_BYTES, sniff, tooBig, wrongType, type ImageType } from './image-files';
import { change, fighterOf, see } from './warband-state';

export { IMAGE_TYPES, MAX_IMAGE_BYTES, readLimited, sniff, type ImageType } from './image-files';

/** Check an image's size and signature; its content type. */
export function check(bytes: Uint8Array): ImageType {
	if (bytes.byteLength > MAX_IMAGE_BYTES) throw tooBig();
	const type = sniff(bytes);
	if (!type || !bytes.byteLength) throw wrongType();
	return type;
}

const dirOf = (warbandId: string) => files.uploadsDir('fighters', warbandId);

/** Write the file next to its place; `commit` moves it in (after the row is saved), `discard` drops it. */
export const stage = (warbandId: string, fighterId: string, bytes: Uint8Array) =>
	files.stage(dirOf(warbandId), fighterId, bytes);

/** The stored bytes, or null when the file is missing. */
export const read = (warbandId: string, fighterId: string) =>
	files.readAt(dirOf(warbandId), fighterId);

/** Remove one fighter's file; a missing file is fine. */
export const removeFile = (warbandId: string, fighterId: string) =>
	files.removeAt(dirOf(warbandId), fighterId);

/** Remove the files of whole warbands (deleted, or their owner's account anonymised). */
export async function removeWarbands(warbandIds: string[]) {
	for (const id of warbandIds)
		await rm(dirOf(id), { recursive: true, force: true }).catch((err) =>
			logger.warn({ err, warbandId: id }, 'Could not remove fighter images')
		);
}

// ---------------------------------------------------------------- a fighter's image (rows and access)

/**
 * Give a fighter an image (replacing any): PNG, JPEG or WebP up to 2 MB, checked by its first bytes and stored as
 * sent. The file is moved into place only once the row is saved.
 */
export async function setImage(ctx: Ctx, id: string, fid: string, bytes: Uint8Array) {
	const type = check(bytes);
	let file: Awaited<ReturnType<typeof stage>> | undefined;
	try {
		const out = await change(ctx, id, async (tx, l) => {
			fighterOf(l, fid);
			file = await stage(id, fid, bytes);
			await repo.updateFighter(tx, fid, { image: type });
		});
		await file!.commit();
		return out;
	} catch (e) {
		await file?.discard();
		throw e;
	}
}

/** Back to the empty image slot. */
export async function clearImage(ctx: Ctx, id: string, fid: string) {
	const out = await change(ctx, id, async (tx, l) => {
		fighterOf(l, fid);
		await repo.updateFighter(tx, fid, { image: null });
	});
	await removeFile(id, fid);
	return out;
}

/** A fighter's image for whoever may see its warband (its owner; its campaign's CM and co-CMs). */
export async function image(ctx: Ctx, fid: string) {
	const row = await repo.fighterById(db(), fid);
	if (!row?.image) throw new AppError('not_found', 'No such image.');
	await see(db(), ctx, row.warbandId);
	const bytes = await read(row.warbandId, fid);
	if (!bytes) throw new AppError('not_found', 'No such image.');
	return { bytes, type: row.image, version: row.version };
}
