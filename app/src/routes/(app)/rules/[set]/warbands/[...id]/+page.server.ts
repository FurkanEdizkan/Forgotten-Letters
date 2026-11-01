import { error } from '@sveltejs/kit';
import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { factionView, variantView } from '#lib/rules/views';
import { m } from '#lib/messages';
import type { PageServerLoad } from './$types';

// One page for factions and their variants: the id (faction:… or variant:…) says which view.
export const load: PageServerLoad = async (event) => {
	const { set, id } = event.params;
	const els = await orPageError(
		event,
		rules.elements(ctxOf(event), set, [
			'faction',
			'variant',
			'unit',
			'line',
			'item',
			'upgrade',
			'patron'
		])
	);
	const faction = id.startsWith('faction:') ? factionView(els, id) : null;
	const variant = id.startsWith('variant:') ? variantView(els, id) : null;
	if (!faction && !variant)
		error(404, { message: m.errors.byStatus[404]!, requestId: event.locals.requestId });
	return { faction, variant };
};
