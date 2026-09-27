import { error, fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { regionWeather } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { getFx, trigger, zeppelinEvent } from '$lib/server/fx';
import { publish } from '$lib/server/hub';
import { buildGraph } from '$lib/rules/zones';
import { weatherByRoll } from '$lib/rules/weather';
import { TRIGGER_LABELS, normaliseLayers, type TriggerKind } from '$lib/fx/types';
import { publicSnapshot } from '$lib/server/public';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	return {
		snapshot: await publicSnapshot(c),
		fx: await getFx(c.id),
		zones: [...buildGraph(c.houseZones).zones.values()],
		regions: (await db
			.select()
			.from(regionWeather)
			.where(eq(regionWeather.campaignId, c.id))
			.orderBy(desc(regionWeather.createdAt))
			)
			.map((r) => ({ ...r, zones: r.zones as string[] | null, layers: normaliseLayers(r.fx) }))
	};
};

async function need() {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	return c;
}

export const actions: Actions = {
	trigger: async ({ request }) => {
		const c = await need();
		const data = await request.formData();
		const kind = String(data.get('kind')) as TriggerKind;
		if (!(kind in TRIGGER_LABELS)) return fail(400, { message: 'Unknown effect' });
		const zone = String(data.get('zone') ?? '');
		trigger(c, kind, buildGraph(c.houseZones).zones.has(zone) ? zone : null);
		return { triggered: kind };
	},

	zeppelin: async ({ request }) => {
		const c = await need();
		const data = await request.formData();
		const via = String(data.get('via') ?? '');
		const seconds = Number(data.get('seconds'));
		zeppelinEvent(c, {
			text: String(data.get('text') ?? '').trim().slice(0, 160) || 'A zeppelin passes over the front.',
			via: buildGraph(c.houseZones).zones.has(via) ? via : null,
			seconds: Number.isFinite(seconds) ? Math.min(180, Math.max(15, seconds)) : 45,
			bomb: data.has('bomb') && buildGraph(c.houseZones).zones.has(via)
		});
		return { zeppelin: true };
	},

	addRegion: async ({ request }) => {
		const c = await need();
		const data = await request.formData();
		const valid = buildGraph(c.houseZones).zones;
		const wholeMap = data.has('wholeMap');
		const zones = data.getAll('zones').map(String).filter((z) => valid.has(z));
		const event = Number(data.get('weatherEvent'));
		let layers = {};
		try {
			layers = normaliseLayers(JSON.parse(String(data.get('layers') ?? '{}')));
		} catch {
			/* no layers */
		}
		const hasLayers = Object.values(layers).some((l) => (l as { on: boolean }).on);
		if (!weatherByRoll(event) && !hasLayers)
			return fail(400, { regionMessage: 'Choose a Hell on Earth event or at least one weather layer' });
		if (!wholeMap && !zones.length) return fail(400, { regionMessage: 'Choose zones, or the whole map' });
		const games = Number(data.get('gamesRemaining'));
		(await db.insert(regionWeather)
			.values({
				campaignId: c.id,
				name: String(data.get('name') ?? '').trim() || null,
				zones: wholeMap ? null : zones,
				weatherEvent: weatherByRoll(event) ? event : null,
				fx: layers,
				gamesRemaining: Number.isInteger(games) && games > 0 ? games : null,
				active: true
			})
			);
		publish(c.id);
		return { regionAdded: true };
	},

	toggleRegion: async ({ request }) => {
		const c = await need();
		const id = String((await request.formData()).get('id'));
		const r = (await db
			.select()
			.from(regionWeather)
			.where(and(eq(regionWeather.id, id), eq(regionWeather.campaignId, c.id)))
			)[0];
		if (!r) return fail(404);
		(await db.update(regionWeather).set({ active: !r.active }).where(eq(regionWeather.id, id)));
		publish(c.id);
		return {};
	},

	deleteRegion: async ({ request }) => {
		const c = await need();
		const id = String((await request.formData()).get('id'));
		(await db.delete(regionWeather)
			.where(and(eq(regionWeather.id, id), eq(regionWeather.campaignId, c.id)))
			);
		publish(c.id);
		return {};
	}
};
