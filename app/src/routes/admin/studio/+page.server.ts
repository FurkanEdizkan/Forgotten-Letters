import { fail, redirect } from '@sveltejs/kit';
import { FACTIONS } from '$lib/rules/factions';
import { parseTemplate, slug } from '$lib/faction-template';
import { applyPack, previewPack, saveFaction, studioEntries } from '$lib/server/studio';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ entries: await studioEntries() });

const known = () => ({ factions: FACTIONS.map((f) => ({ id: f.id, name: f.name })) });

async function yamlOf(d: FormData) {
	const file = d.get('file');
	if (file instanceof File && file.size) return file.text();
	return String(d.get('yaml') ?? '');
}

export const actions: Actions = {
	newFaction: async ({ request }) => {
		const d = await request.formData();
		const name = String(d.get('name') ?? '').trim().slice(0, 80);
		const id = slug(name);
		if (!id) return fail(400, { message: 'Give the faction a name.' });
		if (FACTIONS.some((f) => f.id === id)) return fail(400, { message: `There is already a faction called “${name}”.` });
		await saveFaction({ id, name, alignment: d.get('alignment') === 'fallen' ? 'fallen' : 'faithful', parent: null, description: null, colours: null });
		redirect(303, `/admin/studio/${id}`);
	},

	newVariant: async ({ request }) => {
		const d = await request.formData();
		const name = String(d.get('name') ?? '').trim().slice(0, 120);
		const parent = FACTIONS.find((f) => f.id === d.get('parent'));
		if (!name || !parent) return fail(400, { message: 'Pick the faction and give the variant a name.' });
		if (parent.variants.some((v) => slug(v) === slug(name))) return fail(400, { message: `${parent.name} already has “${name}”.` });
		const id = `${parent.id}--${slug(name)}`;
		await saveFaction({ id, name, alignment: parent.alignment, parent: parent.id, description: null, colours: null });
		redirect(303, `/admin/studio/${id}`);
	},

	/** Read a template and show what it would do; `apply` writes it. */
	import: async ({ request }) => {
		const d = await request.formData();
		const yaml = await yamlOf(d);
		if (!yaml.trim()) return fail(400, { message: 'Choose a template file or paste one.' });
		const { pack, errors } = parseTemplate(yaml, known());
		if (!pack) return fail(400, { yaml, errors });
		if (!d.has('apply')) return { yaml, preview: { name: pack.faction.name, id: pack.faction.id, ...(await previewPack(pack)) } };
		await applyPack(pack);
		redirect(303, `/admin/studio/${pack.faction.id}`);
	}
};
