import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { db } from '$lib/server/db';
import { model } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { resolveUpload } from '$lib/server/uploads';

/** The source STL, for re-rendering a token. Behind the /admin guard; never public. */
export async function GET({ params }) {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const m = db
		.select()
		.from(model)
		.where(and(eq(model.id, params.id), eq(model.campaignId, c.id)))
		.get();
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
