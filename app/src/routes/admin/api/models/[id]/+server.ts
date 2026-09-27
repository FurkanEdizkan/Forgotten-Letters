import { error, json } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { deleteModel } from '$lib/server/models';
import { publish } from '$lib/server/hub';

export async function DELETE({ params }) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	if (!(await deleteModel(c.id, params.id))) error(404, 'No such model');
	publish(c.id);
	return json({ ok: true });
}
