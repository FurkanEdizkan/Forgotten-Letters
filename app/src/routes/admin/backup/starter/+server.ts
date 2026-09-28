import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { exportStarter } from '$lib/server/starter';

/** The shareable starter pack (see lib/server/starter.ts), to commit as app/seed/starter.json. */
export async function GET() {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	return new Response(JSON.stringify(await exportStarter(c.id), null, '\t') + '\n', {
		headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="starter.json"' }
	});
}
