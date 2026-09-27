import { error, fail } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { allLore, loreFor, saveLore } from '$lib/server/lore';
import { publish } from '$lib/server/hub';
import { removeImage, saveImage } from '$lib/server/uploads';
import { buildGraph } from '$lib/rules/zones';
import { LORE_SEED } from '$lib/lore-seed';
import type { Actions, PageServerLoad } from './$types';

const MAX_LORE = 20_000;

export const load: PageServerLoad = ({ url }) => {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const zones = [...buildGraph(c.houseZones).zones.values()].sort((a, b) => a.name.localeCompare(b.name));
	const written = allLore(c.id);
	const selected = url.searchParams.get('zone') ?? zones[0].id;
	const current = loreFor(c.id, selected);
	return {
		zones: zones.map((z) => ({
			id: z.id,
			name: z.name,
			type: z.type,
			status: written.get(z.id)?.lore.trim() ? 'written' : LORE_SEED[z.id] ? 'guide' : 'empty'
		})),
		selected,
		lore: current
	};
};

export const actions: Actions = {
	save: async ({ request }) => {
		const c = currentCampaign();
		if (!c) return fail(404);
		const data = await request.formData();
		const zoneId = String(data.get('zone'));
		if (!buildGraph(c.houseZones).zones.has(zoneId)) return fail(400, { message: 'Unknown zone' });
		const lore = String(data.get('lore') ?? '').slice(0, MAX_LORE);
		let image: string | null | undefined;
		try {
			const uploaded = await saveImage(c.id, data.get('image'), 1200, 'inside');
			if (uploaded || data.has('clearImage')) {
				await removeImage(allLore(c.id).get(zoneId)?.image);
				image = uploaded;
			}
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
		saveLore(c.id, zoneId, lore, image);
		publish(c.id);
		return { saved: zoneId };
	},

	import: async ({ request }) => {
		const c = currentCampaign();
		if (!c) return fail(404);
		const file = (await request.formData()).get('file');
		if (!(file instanceof File) || !file.size) return fail(400, { message: 'Choose a lore JSON file' });
		let entries: Record<string, string>;
		try {
			entries = JSON.parse(await file.text());
		} catch {
			return fail(400, { message: 'That file is not valid JSON' });
		}
		const zones = buildGraph(c.houseZones).zones;
		let count = 0;
		for (const [zoneId, text] of Object.entries(entries ?? {})) {
			if (!zones.has(zoneId) || typeof text !== 'string' || !text.trim()) continue;
			saveLore(c.id, zoneId, text.slice(0, MAX_LORE));
			count++;
		}
		publish(c.id);
		return { imported: count };
	}
};
