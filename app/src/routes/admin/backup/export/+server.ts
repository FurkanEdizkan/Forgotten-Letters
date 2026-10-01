import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { exportCampaign, freshStart } from '$lib/server/backup';

/** The whole campaign, or with ?fresh the campaign set up but not yet played (see freshStart). */
export async function GET({ url }) {
	const fresh = url.searchParams.has('fresh');
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const full = await exportCampaign(c.id);
	const backup = fresh ? freshStart(full) : full;
	const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
	const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
	return new Response(JSON.stringify(backup), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="${slug}-${fresh ? 'fresh-start' : stamp}.json"`
		}
	});
}
