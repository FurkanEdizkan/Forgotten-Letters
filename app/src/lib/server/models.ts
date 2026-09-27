import sharp from 'sharp';
import { and, eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from './db';
import { model, type ModelParams } from './db/schema';
import { removeImage, uploadsDir } from './uploads';
import { looksLikeStl, type ModelKind, type ModelOwner } from '$lib/models';

export const MAX_STL_BYTES = 25 * 1024 * 1024;
const TOKEN_SIZE = 256;

export function listModels(campaignId: string) {
	return db.select().from(model).where(eq(model.campaignId, campaignId)).all();
}

export function findModel(campaignId: string, kind: ModelKind, ownerType: ModelOwner, ownerId: string) {
	return db
		.select()
		.from(model)
		.where(
			and(eq(model.campaignId, campaignId), eq(model.kind, kind), eq(model.ownerType, ownerType), eq(model.ownerId, ownerId))
		)
		.get();
}

function cleanParams(raw: unknown): ModelParams {
	const p = (raw ?? {}) as Record<string, unknown>;
	const num = (v: unknown, lo: number, hi: number, d: number) =>
		typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
	return {
		yaw: num(p.yaw, -180, 180, 0),
		pitch: num(p.pitch, 0, 89, 46),
		scale: num(p.scale, 0.3, 2, 1),
		tint: typeof p.tint === 'string' && /^#[0-9a-f]{6}$/i.test(p.tint) ? p.tint.toLowerCase() : undefined,
		zUp: p.zUp !== false
	};
}

async function store(campaignId: string, bytes: Buffer, ext: string) {
	const name = `${crypto.randomUUID()}.${ext}`;
	const dir = join(uploadsDir(), campaignId);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), bytes);
	return `/uploads/${campaignId}/${name}`;
}

/**
 * Save a rendered token (PNG from the browser) and, optionally, a new source STL.
 * Replaces any earlier model for the same owner; keeps the old STL when no new one is sent.
 */
export async function saveModel(
	campaignId: string,
	kind: ModelKind,
	ownerType: ModelOwner,
	ownerId: string,
	tokenFile: FormDataEntryValue | null,
	stlFile: FormDataEntryValue | null,
	rawParams: unknown
) {
	if (!(tokenFile instanceof File) || tokenFile.size === 0) throw new Error('No token image');
	if (tokenFile.size > 4 * 1024 * 1024) throw new Error('Token image is too large');
	let stl: string | null = null;
	if (stlFile instanceof File && stlFile.size > 0) {
		if (stlFile.size > MAX_STL_BYTES) throw new Error('STL is larger than 25 MB');
		const bytes = Buffer.from(await stlFile.arrayBuffer());
		if (!looksLikeStl(bytes)) throw new Error('That file does not look like an STL');
		stl = await store(campaignId, bytes, 'stl');
	}
	// Fit inside the square without cropping; transparency survives into WebP.
	const png = Buffer.from(await tokenFile.arrayBuffer());
	const webp = await sharp(png)
		.resize(TOKEN_SIZE, TOKEN_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.webp({ quality: 88, alphaQuality: 90 })
		.toBuffer();
	const token = await store(campaignId, webp, 'webp');

	const prev = findModel(campaignId, kind, ownerType, ownerId);
	const params = cleanParams(rawParams);
	if (prev) {
		db.update(model)
			.set({ token, stl: stl ?? prev.stl, params, updatedAt: new Date() })
			.where(eq(model.id, prev.id))
			.run();
		await removeImage(prev.token);
		if (stl) await removeImage(prev.stl);
	} else {
		db.insert(model).values({ campaignId, kind, ownerType, ownerId, token, stl, params }).run();
	}
}

export async function deleteModel(campaignId: string, id: string) {
	const m = db
		.select()
		.from(model)
		.where(and(eq(model.id, id), eq(model.campaignId, campaignId)))
		.get();
	if (!m) return false;
	db.delete(model).where(eq(model.id, m.id)).run();
	await removeImage(m.token);
	await removeImage(m.stl);
	return true;
}

/** Remove every model a warband owns (used when the warband is deleted). */
export async function deleteWarbandModels(campaignId: string, warbandId: string) {
	const rows = listModels(campaignId).filter((m) => m.ownerType === 'warband' && m.ownerId === warbandId);
	for (const m of rows) await deleteModel(campaignId, m.id);
}
