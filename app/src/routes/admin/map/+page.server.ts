import { fail } from '@sveltejs/kit';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { clearMapImage, mapInfo, saveZones, setMapImage } from '$lib/server/map';
import { ALL_ZONES, PRESET_ZONES } from '$lib/rules/zones';
import { parseZones, readZones } from '$lib/map-template';
import type { Zone } from '$lib/rules/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const c = await currentCampaign();
	const used = c
		? [
				...(await db.select({ z: warband.entryZone }).from(warband).where(and(eq(warband.campaignId, c.id), isNotNull(warband.entryZone)))),
				...(await db.select({ z: game.zone }).from(game).where(eq(game.campaignId, c.id)))
			].map((r) => r.z)
		: [];
	return { hasCampaign: !!c, map: await mapInfo(), zones: [...ALL_ZONES], inUse: [...new Set(used.filter((z): z is string => !!z))] };
};

async function save(zones: Zone[] | null, errors: { path: string; message: string }[]) {
	if (!zones) return fail(400, { errors });
	const { inUse } = await saveZones(zones);
	if (inUse.length) return fail(400, { errors: [{ path: 'zones', message: `warbands started or games were fought in ${inUse.join(', ')}: keep those zones` }] });
	return { saved: true };
}

export const actions: Actions = {
	image: async ({ request }) => {
		try {
			await setMapImage((await request.formData()).get('image'));
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
		return { saved: true };
	},
	clearImage: async () => {
		await clearMapImage();
		return { saved: true };
	},
	save: async ({ request }) => {
		let input: unknown;
		try {
			input = JSON.parse(String((await request.formData()).get('zones') ?? ''));
		} catch {
			return fail(400, { errors: [{ path: 'zones', message: 'could not be read' }] });
		}
		const { zones, errors } = readZones(input);
		return save(zones, errors);
	},
	import: async ({ request }) => {
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || !file.size) return fail(400, { message: 'Choose a zones file (.yaml).' });
		const { zones, errors } = parseZones(await file.text());
		return save(zones, errors);
	},
	preset: async () => save(PRESET_ZONES, [])
};
