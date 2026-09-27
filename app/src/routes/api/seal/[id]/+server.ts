import { error, json } from '@sveltejs/kit';
import sharp from 'sharp';
import { and, eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { canEditWarband } from '$lib/server/auth';
import { publish } from '$lib/server/hub';
import { removeImage, saveImage, uploadsDir } from '$lib/server/uploads';
import { SEAL_FRAME, SEAL_FRAMES, cleanColours, type SealSettings } from '$lib/seals';

const MAX_STRIP = 8 * 1024 * 1024;

/** A struck strip from the player's browser: exactly the expected frames, stored as WebP with its alpha. */
async function saveStrip(campaignId: string, file: FormDataEntryValue | null) {
	if (!(file instanceof File) || file.size === 0 || file.size > MAX_STRIP) error(400, 'Missing or oversized seal strip');
	const input = Buffer.from(await file.arrayBuffer());
	const meta = await sharp(input).metadata();
	if (meta.width !== SEAL_FRAME * SEAL_FRAMES || meta.height !== SEAL_FRAME) error(400, 'The seal strip has the wrong size');
	const out = await sharp(input).webp({ quality: 88, alphaQuality: 92 }).toBuffer();
	const name = `seal-${crypto.randomUUID()}.webp`;
	const dir = join(uploadsDir(), campaignId);
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), out);
	return `/uploads/${campaignId}/${name}`;
}

/**
 * Save a warband's seal: its colours, and optionally a seal struck from its own symbol
 * (mode 'custom' with new strips) or a return to the faction's seal (mode 'faction').
 * Allowed for the Campaign Master and for the device holding that warband's player link.
 */
export async function POST({ params, request, locals }) {
	if (!canEditWarband(locals.user, params.id)) error(403, 'Only this warband’s player can change its seal');
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const [w] = await db
		.select()
		.from(warband)
		.where(and(eq(warband.id, params.id), eq(warband.campaignId, c.id)));
	if (!w) error(404, 'No such warband');

	const data = await request.formData();
	const prev: SealSettings = w.seal ?? {};
	const next: SealSettings = { ...cleanColours(Object.fromEntries(data)), custom: prev.custom ?? null };
	const mode = String(data.get('mode') ?? 'keep');
	const stale: (string | undefined)[] = [];
	if (mode === 'custom' && data.get('base')) {
		const base = await saveStrip(c.id, data.get('base'));
		const light = await saveStrip(c.id, data.get('light'));
		const source = (await saveImage(c.id, data.get('source'), 1024, 'inside')) ?? prev.custom?.source ?? '';
		stale.push(prev.custom?.base, prev.custom?.light, prev.custom?.source === source ? undefined : prev.custom?.source);
		next.custom = { base, light, source };
	} else if (mode === 'faction') {
		stale.push(prev.custom?.base, prev.custom?.light, prev.custom?.source);
		next.custom = null;
	}

	await db.update(warband).set({ seal: next }).where(eq(warband.id, w.id));
	for (const p of stale) await removeImage(p);
	publish(c.id);
	return json({ ok: true });
}
