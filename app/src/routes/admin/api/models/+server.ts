import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { saveModel } from '$lib/server/models';
import { publish } from '$lib/server/hub';
import { FACTIONS } from '$lib/rules/factions';

/**
 * Save a model token rendered in the browser: multipart { kind, ownerType, ownerId, token (PNG), stl?, params (JSON) }.
 */
export async function POST({ request }) {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const data = await request.formData().catch(() => null);
	if (!data) error(400, 'Malformed request');
	const kind = String(data.get('kind'));
	const ownerType = String(data.get('ownerType'));
	const ownerId = String(data.get('ownerId'));
	if (kind !== 'outpost' && kind !== 'figure') error(400, 'Unknown model kind');
	if (ownerType === 'faction') {
		if (!FACTIONS.some((f) => f.id === ownerId)) error(400, 'Unknown faction');
	} else if (ownerType === 'warband') {
		const w = db
			.select({ id: warband.id })
			.from(warband)
			.where(and(eq(warband.id, ownerId), eq(warband.campaignId, c.id)))
			.get();
		if (!w) error(400, 'Unknown warband');
	} else error(400, 'Unknown owner');

	let params: unknown = {};
	try {
		params = JSON.parse(String(data.get('params') ?? '{}'));
	} catch {
		/* defaults */
	}
	try {
		await saveModel(c.id, kind, ownerType, ownerId, data.get('token'), data.get('stl'), params);
	} catch (e) {
		return json({ message: (e as Error).message }, { status: 400 });
	}
	publish(c.id);
	return json({ ok: true });
}
