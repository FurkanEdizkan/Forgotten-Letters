import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as roster from '#lib/server/services/warband-roster';
import { recruitInput } from '#lib/schemas/warbands';
import { idParam } from '#lib/api-types';

/**
 * Recruit an entry with any upgrades and loadout (its armoury lines), paid from the banks and checked as one purchase;
 * refused with the engine's reasons (unless the campaign allows beyond limits).
 * Who: its owner.
 * In: path id; { unitId, name?, upgrades?, kit? }
 * Out: 201 Warband
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not the owner or other site, 404 not_found, 409 conflict refused with its reasons.
 */
export const POST = api(async (event, ctx) =>
	json(
		await roster.recruit(ctx, parse(idParam, event.params).id, await body(event, recruitInput)),
		{
			status: 201
		}
	)
);
