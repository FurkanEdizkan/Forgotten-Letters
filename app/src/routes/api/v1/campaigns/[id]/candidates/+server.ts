import { api, parse } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import * as seats from '#lib/server/services/seats';
import { candidatesFor, idParam } from '#lib/api-types';

/**
 * People to pick from, up to 10 matching q: for=seat (default) active accounts without a seat here; for=co_cm active Admins and Owners without rights here.
 * Who: the CM and co-CMs (for=seat); the CM (for=co_cm).
 * In: path id; query ?q=<1..32>&for=seat|co_cm
 * Out: 200 { items: Candidate[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
 */
export const GET = api(async (event, ctx) => {
	const { id } = parse(idParam, event.params);
	const { q, for: who } = parse(candidatesFor, Object.fromEntries(event.url.searchParams));
	return {
		items: await (who === 'co_cm'
			? campaigns.coCmCandidates(ctx, id, q)
			: seats.candidates(ctx, id, q))
	};
});
