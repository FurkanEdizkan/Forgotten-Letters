import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Direct links by default: two steps out reaches every armoury line of a faction and crowds the graph.
	const depth = event.url.searchParams.get('depth') === '2' ? 2 : 1;
	const node = await orPageError(
		event,
		rules.node(ctxOf(event), event.params.set, event.params.id, depth)
	);
	return { node, depth };
};
