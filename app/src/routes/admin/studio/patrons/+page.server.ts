import { fail } from '@sveltejs/kit';
import { readPatrons } from '$lib/patrons';
import { FACTIONS } from '$lib/rules/factions';
import { studioEdition } from '$lib/server/editions';
import { patronRows, editorNames, removeCampaign, revertCampaign, savePatron } from '$lib/server/studio-campaign';
import type { Actions, PageServerLoad } from './$types';

/** The Rules Editor's Patrons: each Patron of the edition and its Skills, with their prices and limits. */
export const load: PageServerLoad = async ({ url, cookies }) => {
	const edition = await studioEdition({ url, cookies });
	const patrons = (await patronRows(edition)).sort((a, b) => a.name.localeCompare(b.name));
	return {
		edition,
		patrons: patrons.map(({ bookCopy, ...p }) => ({ ...p, revertible: !!bookCopy })),
		entry: url.searchParams.get('entry'),
		factions: FACTIONS.map((f) => ({ id: f.id, name: f.name, variants: f.variants })),
		...(await editorNames(edition))
	};
};

const json = (d: FormData, k: string, i: number): unknown => {
	try {
		const v = JSON.parse(String(d.getAll(k)[i] ?? ''));
		return Array.isArray(v) && !v.length ? undefined : v;
	} catch {
		return undefined;
	}
};

export const actions: Actions = {
	save: async ({ request, url, cookies }) => {
		const d = await request.formData();
		const s = (k: string) => String(d.get(k) ?? '').trim();
		const all = (k: string) => d.getAll(k).map((x) => String(x).trim()).filter(Boolean);
		// Each Skill posts its fields in order: name, text, and its limits and prices as JSON.
		const skills = d
			.getAll('sk_name')
			.map((n, i) => ({
				name: String(n).trim(),
				text: String(d.getAll('sk_text')[i] ?? '').trim(),
				...Object.fromEntries(
					[
						['limits', json(d, 'sk_limits', i)],
						['prices', json(d, 'sk_prices', i)]
					].filter(([, v]) => v !== undefined)
				)
			}))
			.filter((x) => x.name);
		const errors: { path: string; message: string }[] = [];
		const [p] = readPatrons(
			[{ name: s('name'), source: s('source') || undefined, alignment: s('alignment') || undefined, factions: all('factions'), variants: all('variants'), text: s('text'), skills }],
			(path, message) => errors.push({ path, message })
		);
		if (!p || errors.length) return fail(400, { errors, at: s('id') || 'new' });
		// A Patron keeps its id when renamed (warbands name it by name, the rules by id).
		const id = s('id') || p.id;
		await savePatron({ ...p, id }, await studioEdition({ url, cookies }));
		return { saved: id };
	},

	revert: async ({ request, url, cookies }) => {
		const id = String((await request.formData()).get('id') ?? '');
		await revertCampaign('patron', id, await studioEdition({ url, cookies }));
		return { saved: id };
	},

	remove: async ({ request, url, cookies }) => {
		const id = String((await request.formData()).get('id') ?? '');
		await removeCampaign('patron', id, await studioEdition({ url, cookies }));
		return { removed: id };
	}
};
