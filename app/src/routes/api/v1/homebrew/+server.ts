import { json } from '@sveltejs/kit';
import { api, body } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import { homebrewCreate } from '#lib/schemas/homebrew';

/**
 * My homebrew sets and the ones others shared, by name, each with whether it passes its checks.
 * Who: anyone signed in.
 * In: nothing.
 * Out: 200 { mine: HomebrewCard[], shared: HomebrewCard[] }
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => homebrew.list(ctx));

/**
 * Make a homebrew set on a rules set: a blank faction, a blank variant of a faction, blank items, or a copy of a faction or variant.
 * Who: anyone signed in, on rules they can see.
 * In: { name, base, start: faction|variant|items|copy, of? (the faction or variant) }
 * Out: 201 Homebrew
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found base not loaded.
 */
export const POST = api(async (event, ctx) =>
	json(await homebrew.create(ctx, await body(event, homebrewCreate)), { status: 201 })
);
