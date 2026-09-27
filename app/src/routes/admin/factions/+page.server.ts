import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { listModels } from '$lib/server/models';
import { FACTIONS } from '$lib/rules/factions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const models = listModels(c.id).filter((m) => m.ownerType === 'faction');
	const pick = (kind: 'outpost' | 'figure', faction: string) => {
		const m = models.find((m) => m.kind === kind && m.ownerId === faction);
		return m ? { id: m.id, token: m.token, hasStl: !!m.stl, params: m.params } : null;
	};
	return {
		factions: FACTIONS.map((f) => ({
			id: f.id,
			name: f.name,
			outpost: pick('outpost', f.id),
			figure: pick('figure', f.id)
		}))
	};
};
