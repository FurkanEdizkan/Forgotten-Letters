import { api, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { choicesQuery } from '#lib/schemas/warbands';

/**
 * What a new warband may be: the loaded rules, then each faction with its variants, starting Ducats and Patrons.
 * Who: anyone signed in.
 * In: query ?rules=<core or core+expansion> (default the newest core).
 * Out: 200 WarbandChoices
 * Errors: 400 invalid, 401 unauthenticated, 404 not_found rules not loaded.
 */
export const GET = api(async (event, ctx) =>
	warbands.choices(ctx, parse(choicesQuery, Object.fromEntries(event.url.searchParams)).rules)
);
