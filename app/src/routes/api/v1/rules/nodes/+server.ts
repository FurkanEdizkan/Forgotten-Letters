import { api, parse } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { nodesQuery } from '#lib/schemas/rules';

/**
 * Elements of a set (with its base chain) whose name contains q, by name.
 * Who: anyone signed in.
 * In: query ?set=<folder>&q=<0..80>&type=<id type>&limit=<1..100, default 50>
 * Out: 200 { items: RulesElement[], next: null }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found set not loaded.
 */
export const GET = api(async (event, ctx) => {
	const { set, ...opts } = parse(nodesQuery, Object.fromEntries(event.url.searchParams));
	return { items: await rules.search(ctx, set, opts), next: null };
});
