import { error, json } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { saveFx } from '$lib/server/fx';
import { normaliseFx } from '$lib/fx/types';

/** Live console: the page posts the whole ambient config on every change. */
export async function POST({ request }) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const config = normaliseFx(await request.json().catch(() => null));
	await saveFx(c.id, config);
	return json(config);
}
