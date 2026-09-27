import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { unit } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { canEditWarband } from '$lib/server/auth';
import { publish } from '$lib/server/hub';
import { removeImage, saveImage } from '$lib/server/uploads';

/**
 * Change a unit's own picture (`image`), or go back to its type's default (`clear`).
 * Allowed for the Campaign Master and for the device holding that warband's player link.
 */
export async function POST({ params, request, locals }) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const [u] = await db
		.select()
		.from(unit)
		.where(and(eq(unit.id, params.id), eq(unit.campaignId, c.id)));
	if (!u) error(404, 'No such model');
	if (!canEditWarband(locals.user, u.warbandId)) error(403, 'Only this warband’s player can change its pictures');

	const data = await request.formData();
	let photo: string | null = u.photo;
	if (data.has('clear')) photo = null;
	else {
		try {
			photo = await saveImage(c.id, data.get('image'), 640);
		} catch (e) {
			error(400, (e as Error).message);
		}
		if (!photo) error(400, 'Choose an image');
	}
	await db.update(unit).set({ photo }).where(eq(unit.id, u.id));
	if (u.photo && u.photo !== photo) await removeImage(u.photo);
	publish(c.id);
	return json({ photo });
}
