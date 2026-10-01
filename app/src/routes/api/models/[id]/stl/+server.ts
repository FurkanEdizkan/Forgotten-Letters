import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { currentCampaign } from '$lib/server/campaign';
import { resolveUpload } from '$lib/server/uploads';
import { mayEditModel, modelById } from '$lib/server/models';

/** The source STL, for re-rendering a token: only to whoever may edit the model, never public. */
export async function GET({ params, locals }) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const m = await modelById(c.id, params.id);
	if (m && !mayEditModel(locals, m.ownerType, m.ownerId)) error(403, 'Not your warband');
	const full = m?.stl ? resolveUpload(m.stl) : null;
	if (!full) error(404, 'No STL kept for this model');
	try {
		return new Response(await readFile(full), {
			headers: { 'content-type': 'model/stl', 'cache-control': 'private, no-store' }
		});
	} catch {
		error(404, 'STL file missing');
	}
}
