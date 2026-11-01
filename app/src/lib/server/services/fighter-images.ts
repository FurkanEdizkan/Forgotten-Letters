/**
 * Fighter image files: PNG, JPEG or WebP up to 2 MB, told apart by their first bytes (never the name or the
 * declared type), kept exactly as uploaded (no re-encoding, no new dependency) under
 * `<UPLOADS_DIR>/fighters/<warband id>/<fighter id>`. A new file is written beside the old one and renamed over it,
 * so a reader never sees half a file, and only once the fighter's row is saved. Who may see an image is who may see
 * its warband (warband-state).
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { db } from '../db';
import { config } from '../infra/config';
import { logger } from '../infra/logger';
import * as repo from '../repos/warbands';
import type { Ctx } from './audit';
import { change, fighterOf, see } from './warband-state';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

const tooBig = () =>
	new AppError('invalid', 'That image is over 2 MB. Pick a smaller one.', {
		image: 'Use an image of 2 MB or less.'
	});
const wrongType = () =>
	new AppError('invalid', 'That file is not a PNG, JPEG or WebP image.', {
		image: 'Use a PNG, JPEG or WebP image.'
	});

const starts = (b: Uint8Array, at: number, bytes: number[]) =>
	bytes.every((x, i) => b[at + i] === x);

/** The image type a file's signature says, or null. */
export function sniff(b: Uint8Array): ImageType | null {
	if (starts(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (starts(b, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
	// RIFF....WEBP
	if (starts(b, 0, [0x52, 0x49, 0x46, 0x46]) && starts(b, 8, [0x57, 0x45, 0x42, 0x50]))
		return 'image/webp';
	return null;
}

/** Read an upload, stopping as soon as it passes 2 MB, so a large body never fills memory. */
export async function readLimited(
	body: ReadableStream<Uint8Array> | Blob | null
): Promise<Uint8Array> {
	if (!body) throw wrongType();
	if (body instanceof Blob) {
		if (body.size > MAX_IMAGE_BYTES) throw tooBig();
		return new Uint8Array(await body.arrayBuffer());
	}
	const parts: Uint8Array[] = [];
	let size = 0;
	const reader = body.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_IMAGE_BYTES) {
			await reader.cancel();
			throw tooBig();
		}
		parts.push(value);
	}
	const out = new Uint8Array(size);
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.byteLength;
	}
	return out;
}

/** Check an image's size and signature; its content type. */
export function check(bytes: Uint8Array): ImageType {
	if (bytes.byteLength > MAX_IMAGE_BYTES) throw tooBig();
	const type = sniff(bytes);
	if (!type || !bytes.byteLength) throw wrongType();
	return type;
}

const dirOf = (warbandId: string) => join(config().UPLOADS_DIR, 'fighters', warbandId);
const pathOf = (warbandId: string, fighterId: string) => join(dirOf(warbandId), fighterId);

/** Write the file next to its place; `commit` moves it in (after the row is saved), `discard` drops it. */
export async function stage(warbandId: string, fighterId: string, bytes: Uint8Array) {
	await mkdir(dirOf(warbandId), { recursive: true });
	const tmp = join(dirOf(warbandId), `.${fighterId}.${randomUUID()}`);
	await writeFile(tmp, bytes);
	return {
		commit: () => rename(tmp, pathOf(warbandId, fighterId)),
		discard: () => rm(tmp, { force: true })
	};
}

/** The stored bytes, or null when the file is missing. */
export async function read(warbandId: string, fighterId: string): Promise<Buffer | null> {
	try {
		return await readFile(pathOf(warbandId, fighterId));
	} catch {
		return null;
	}
}

/** Remove one fighter's file; a missing file is fine. Never fails the caller: the row is already gone. */
export async function removeFile(warbandId: string, fighterId: string) {
	await rm(pathOf(warbandId, fighterId), { force: true }).catch((err) =>
		logger.warn({ err, fighterId }, 'Could not remove a fighter image')
	);
}

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
