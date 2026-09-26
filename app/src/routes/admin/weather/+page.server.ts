import { error, fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { regionWeather } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { getFx, trigger } from '$lib/server/fx';
import { publish } from '$lib/server/hub';
import { buildGraph } from '$lib/rules/zones';
import { weatherByRoll } from '$lib/rules/weather';
import { TRIGGER_LABELS, type TriggerKind } from '$lib/fx/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	return {
		fx: getFx(c.id),
		zones: [...buildGraph(c.houseZones).zones.values()],
		regions: db
			.select()
			.from(regionWeather)
			.where(eq(regionWeather.campaignId, c.id))
			.orderBy(desc(regionWeather.createdAt))
			.all()
			.map((r) => ({ ...r, zones: r.zones as string[] | null }))
	};
};

function need() {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	return c;
}

export const actions: Actions = {
	trigger: async ({ request }) => {
		const c = need();
		const data = await request.formData();
		const kind = String(data.get('kind')) as TriggerKind;
		if (!(kind in TRIGGER_LABELS)) return fail(400, { message: 'Unknown effect' });
		const zone = String(data.get('zone') ?? '');
		trigger(c, kind, buildGraph(c.houseZones).zones.has(zone) ? zone : null);
		return { triggered: kind };
	},

	addRegion: async ({ request }) => {
		const c = need();
		const data = await request.formData();
		const valid = buildGraph(c.houseZones).zones;
		const wholeMap = data.has('wholeMap');
		const zones = data.getAll('zones').map(String).filter((z) => valid.has(z));
		const event = Number(data.get('weatherEvent'));
		if (!weatherByRoll(event)) return fail(400, { regionMessage: 'Choose a Hell on Earth event' });
		if (!wholeMap && !zones.length) return fail(400, { regionMessage: 'Choose zones, or the whole map' });
		const games = Number(data.get('gamesRemaining'));
		db.insert(regionWeather)
			.values({
				campaignId: c.id,
				name: String(data.get('name') ?? '').trim() || null,
				zones: wholeMap ? null : zones,
				weatherEvent: event,
				gamesRemaining: Number.isInteger(games) && games > 0 ? games : null,
				active: true
			})
			.run();
		publish(c.id);
		return { regionAdded: true };
	},

	toggleRegion: async ({ request }) => {
		const c = need();
		const id = String((await request.formData()).get('id'));
		const r = db
			.select()
			.from(regionWeather)
			.where(and(eq(regionWeather.id, id), eq(regionWeather.campaignId, c.id)))
			.get();
		if (!r) return fail(404);
		db.update(regionWeather).set({ active: !r.active }).where(eq(regionWeather.id, id)).run();
		publish(c.id);
		return {};
	},

	deleteRegion: async ({ request }) => {
		const c = need();
		const id = String((await request.formData()).get('id'));
		db.delete(regionWeather)
			.where(and(eq(regionWeather.id, id), eq(regionWeather.campaignId, c.id)))
			.run();
		publish(c.id);
		return {};
	}
};
