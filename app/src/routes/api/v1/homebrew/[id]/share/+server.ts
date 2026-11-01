import { api, parse } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import { homebrewParams } from '#lib/schemas/homebrew';

/**
 * Share the set with everyone on this install (a set on another homebrew set needs that one shared first).
 * Who: its maker.
 * In: path id.
 * Out: 200 Homebrew
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not its maker or other site, 404 not_found, 409 conflict its base is private.
 */
export const POST = api(async (event, ctx) =>
	homebrew.share(ctx, parse(homebrewParams, event.params).id, true)
);

/**
 * Make the set private again; refused while other people's warbands or sets build on it.
 * Who: its maker.
 * In: path id.
 * Out: 200 Homebrew
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not its maker or other site, 404 not_found, 409 conflict in use by others.
 */
export const DELETE = api(async (event, ctx) =>
	homebrew.share(ctx, parse(homebrewParams, event.params).id, false)
);
