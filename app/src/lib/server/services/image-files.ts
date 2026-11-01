/**
 * Image files in the uploads volume, shared by fighter images and card frames: told apart by their first bytes
 * (never the name or the declared type), read with a size cap, kept exactly as uploaded (no re-encoding, no new
 * dependency). A new file is written beside the old one and renamed over it, so a reader never sees half a file,
 * and only once its row is saved.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { config } from '../infra/config';
import { logger } from '../infra/logger';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const tooBig = () =>
	new AppError('invalid', 'That image is over 2 MB. Pick a smaller one.', {
		image: 'Use an image of 2 MB or less.'
	});
export const wrongType = () =>
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

/** A PNG's width and height from its header chunk (IHDR, always first), or null when it is not a PNG. */
export function pngSize(b: Uint8Array): { width: number; height: number } | null {
	if (sniff(b) !== 'image/png' || b.byteLength < 24 || !starts(b, 12, [0x49, 0x48, 0x44, 0x52]))
		return null;
	const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
	return { width: v.getUint32(16), height: v.getUint32(20) };
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

/** A folder under the uploads volume (`fighters/<warband id>`, `frames`). */
export const uploadsDir = (...parts: string[]) => join(config().UPLOADS_DIR, ...parts);

/** Write the file next to its place; `commit` moves it in (after the row is saved), `discard` drops it. */
export async function stage(dir: string, name: string, bytes: Uint8Array) {
	await mkdir(dir, { recursive: true });
	const tmp = join(dir, `.${name}.${randomUUID()}`);
	await writeFile(tmp, bytes);
	return {
		commit: () => rename(tmp, join(dir, name)),
		discard: () => rm(tmp, { force: true })
	};
}

/** The stored bytes, or null when the file is missing. */
export async function readAt(dir: string, name: string): Promise<Buffer | null> {
	try {
		return await readFile(join(dir, name));
	} catch {
		return null;
	}
}

/** Remove one file; a missing file is fine. Never fails the caller: the row is already gone. */
export async function removeAt(dir: string, name: string) {
	await rm(join(dir, name), { force: true }).catch((err) =>
		logger.warn({ err, file: name }, 'Could not remove an uploaded image')
	);
}
