import { api, body, parse } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { warbandRules } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Switch a warband's rules (core version and expansions). Fighters and kit stay; what the new rules lack shows as
 * problems. Not while it sits in a campaign seat: the campaign's rules apply there.
 * Who: the warband's owner.
 * In: path id; { version, rules: "<core>+<expansion>…" } or { version, rulesSet, rulesExpansions? }
 * Out: 200 Warband
 * Errors: 400 invalid the faction or variant is not in those rules, 401 unauthenticated, 403 forbidden not the
 * owner, 404 not_found the warband or a rules set, 409 conflict seated in a campaign or changed meanwhile.
 */
export const PUT = api(async (event, ctx) =>
	warbands.setRules(ctx, parse(idParam, event.params).id, await body(event, warbandRules))
);
