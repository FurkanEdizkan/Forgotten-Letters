import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { factions } from '#lib/rules/views';
import type { Page } from '#lib/rules/pack';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const els = await orPageError(
		event,
		rules.elements(ctxOf(event), event.params.set, ['faction', 'variant', 'page'])
	);
	return {
		factions: factions(els).map((f) => ({
			id: f.id,
			name: f.name,
			alignment: f.alignment,
			variants: els
				.filter((e) => e.type === 'variant' && e.data.faction === f.id)
				.map((e) => ({ id: e.id, name: e.name }))
		})),
		pages: els
			.filter((e) => e.type === 'page' && e.data.section === 'warbands')
			.map((e) => e.data as Page)
			.sort((a, b) => a.order - b.order)
	};
};
