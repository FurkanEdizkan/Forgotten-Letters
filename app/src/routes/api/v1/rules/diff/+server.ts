import { api, parse } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { diffQuery } from '#lib/schemas/rules';

/**
 * What changed between two rules versions, by element id: added, removed, and changed with each changed field.
 * Who: anyone signed in.
 * In: query ?from=<folder>&to=<folder>
 * Out: 200 { from, to, added, removed, changed }
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found a set not loaded.
 */
export const GET = api(async (event, ctx) => {
	const { from, to } = parse(diffQuery, Object.fromEntries(event.url.searchParams));
	return rules.diff(ctx, from, to);
});
