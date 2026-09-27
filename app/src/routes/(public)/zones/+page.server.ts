import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { loreFor } from '$lib/server/lore';
import { buildGraph } from '$lib/rules/zones';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const excerpts: Record<string, string> = {};
	for (const id of buildGraph(c.houseZones).zones.keys()) {
		const text = (await loreFor(c.id, id)).lore.replace(/[#*>\[\]_]/g, '').replace(/\s+/g, ' ').trim();
		if (text) excerpts[id] = text.length > 140 ? `${text.slice(0, 140).replace(/\s\S*$/, '')}…` : text;
	}
	return { excerpts };
};
