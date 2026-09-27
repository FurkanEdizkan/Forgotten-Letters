import { error, json } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { battleResult } from '$lib/server/fx';
import type { RequestHandler } from './$types';

/** A finished battle's result, so a map can replay its animation for one viewer. */
export const GET: RequestHandler = async ({ params }) => {
	const c = await currentCampaign();
	const battle = c ? await battleResult(c, params.id) : null;
	if (!battle) error(404, 'No such battle');
	return json(battle);
};
