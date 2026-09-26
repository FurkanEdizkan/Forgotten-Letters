import sharp from 'sharp';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, normalize, resolve } from 'node:path';
import { env } from '$env/dynamic/private';

export const uploadsDir = () => resolve(env.UPLOADS_DIR ?? 'data/uploads');

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Re-encode an uploaded image to a square-ish WebP and store it under the campaign.
 * Returns the public path (served by /uploads/[...path]), or null for no file.
 */
export async function saveImage(
	campaignId: string,
	file: FormDataEntryValue | null,
	size: number
): Promise<string | null> {
	if (!(file instanceof File) || file.size === 0) return null;
	if (file.size > MAX_BYTES) throw new Error('Image is larger than 10 MB');
	const input = Buffer.from(await file.arrayBuffer());
	const output = await sharp(input)
		.rotate()
		.resize(size, size, { fit: 'cover', position: 'attention' })
		.webp({ quality: 85 })
		.toBuffer();
	const name = `${crypto.randomUUID()}.webp`;
	const dir = join(uploadsDir(), campaignId);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), output);
	return `/uploads/${campaignId}/${name}`;
}

/** Resolve a public /uploads path to a file inside the uploads dir, or null if it escapes. */
export function resolveUpload(publicPath: string) {
	const root = uploadsDir();
	const full = normalize(join(root, publicPath.replace(/^\/uploads\//, '')));
	return full.startsWith(root + '/') ? full : null;
}

export async function removeImage(publicPath: string | null | undefined) {
	if (!publicPath) return;
	const full = resolveUpload(publicPath);
	if (full) await rm(full, { force: true });
}
