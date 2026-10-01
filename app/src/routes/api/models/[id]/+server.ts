import { error, json } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { deleteModel, mayEditModel, modelById } from '$lib/server/models';
import { publish } from '$lib/server/hub';

export async function DELETE({ params, locals }) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const m = await modelById(c.id, params.id);
	if (!m) error(404, 'No such model');
	if (!mayEditModel(locals, m.ownerType, m.ownerId)) error(403, 'Not your warband');
	await deleteModel(c.id, m.id);
	publish(c.id);
	return json({ ok: true });
}
