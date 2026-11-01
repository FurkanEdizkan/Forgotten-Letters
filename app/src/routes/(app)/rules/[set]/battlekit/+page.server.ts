import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { battlekit } from '#lib/rules/views';
import type { Page } from '#lib/rules/pack';
import type { PageServerLoad } from './$types';

// Every item at once: a set holds a few hundred, and the filters then work as you type, without a round trip.
export const load: PageServerLoad = async (event) => {
	const els = await orPageError(
		event,
		rules.elements(ctxOf(event), event.params.set, ['item', 'line', 'faction', 'variant', 'page'])
	);
	return {
		items: battlekit(els),
		pages: els
			.filter((e) => e.type === 'page' && e.data.section === 'battlekit')
			.map((e) => e.data as Page)
			.sort((a, b) => a.order - b.order)
	};
};
