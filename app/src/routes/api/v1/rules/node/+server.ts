import { api, parse } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { nodeQuery } from '#lib/schemas/rules';

/**
 * One element with its data, every link in and out, and its neighbourhood graph. The id travels as a query
 * parameter, since ids hold `:`, `/` and `#`.
 * Who: anyone signed in.
 * In: query ?set=<folder>&id=<element id>&depth=<1..2, default 2>
 * Out: 200 { node, out: RulesLink[], in: RulesLink[], graph: { nodes, links } }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found set not loaded or no such element.
 */
export const GET = api(async (event, ctx) => {
	const { set, id, depth } = parse(nodeQuery, Object.fromEntries(event.url.searchParams));
	return rules.node(ctx, set, id, depth);
});
