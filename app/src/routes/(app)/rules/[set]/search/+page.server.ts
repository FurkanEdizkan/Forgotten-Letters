import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const q = (event.url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const items = q
		? await orPageError(event, rules.search(ctxOf(event), event.params.set, { q, limit: 50 }))
		: [];
	return { q, items };
};
