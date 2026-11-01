import { json } from '@sveltejs/kit';
import { api, body } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { warbandImport } from '#lib/schemas/warbands';

/**
 * Import a Trench Companion text export, or a JSON export (ours or Trench Companion's), as a new warband; names that
 * do not match are reported, not dropped. Games already played set the refund window and the next game (R1).
 * Who: anyone signed in.
 * In: { text, format? (text | json, default text), gamesPlayed?, name?, rulesSet?, rulesExpansions? }
 * Out: 201 { warband: Warband, unmatched: string[], ambiguous: string[] }
 * Errors: 400 invalid not a warband or no such faction, 401 unauthenticated, 403 forbidden other site, 404 not_found rules not loaded, 409 conflict no rules loaded.
 */
export const POST = api(async (event, ctx) =>
	json(await warbands.importText(ctx, await body(event, warbandImport)), { status: 201 })
);
