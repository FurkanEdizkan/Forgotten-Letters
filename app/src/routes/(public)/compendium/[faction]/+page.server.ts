import { error } from '@sveltejs/kit';
import { allKeywords, itemsOf, unitsOf } from '$lib/server/rules-data';
import { FACTIONS } from '$lib/rules/factions';
import { keywordKey } from '$lib/keywords';
import { currentCampaign } from '$lib/server/campaign';
import { artFor, artIndex } from '$lib/server/unit-art';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const f = params.faction === 'mercenaries' ? { id: 'mercenaries', name: 'Mercenaries', variants: [] as string[] } : FACTIONS.find((x) => x.id === params.faction);
	if (!f) error(404, 'No such faction');
	const [units, items, keywords] = await Promise.all([unitsOf(f.id), itemsOf(f.id), allKeywords()]);
	const c = await currentCampaign();
	const art = c ? await artIndex(c.id) : new Map<string, string>();
	return {
		faction: { id: f.id, name: f.name },
		units: units.map((u) => ({ ...u, picture: artFor(art, f.id, u.name) })),
		items,
		glossary: Object.fromEntries(keywords.map((k) => [keywordKey(k.name), k.text]))
	};
};
