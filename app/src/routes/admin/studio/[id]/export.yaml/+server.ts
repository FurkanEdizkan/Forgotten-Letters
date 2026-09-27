import { error } from '@sveltejs/kit';
import { packOf } from '$lib/server/studio';
import { toTemplate } from '$lib/faction-template';

export async function GET({ params }) {
	const p = await packOf(params.id);
	if (!p) error(404, 'No such faction');
	return new Response(toTemplate(p), {
		headers: { 'content-type': 'text/yaml; charset=utf-8', 'content-disposition': `attachment; filename="${params.id}.yaml"` }
	});
}
