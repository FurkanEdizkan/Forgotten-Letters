import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { exportCampaign } from '$lib/server/backup';

export async function GET() {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const backup = await exportCampaign(c.id);
	const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
	const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
	return new Response(JSON.stringify(backup), {
		headers: {
			'content-type': 'application/json',
			'content-disposition': `attachment; filename="${slug}-${stamp}.json"`
		}
	});
}
