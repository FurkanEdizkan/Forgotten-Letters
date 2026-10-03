import { fail } from '@sveltejs/kit';
import { readProgression, readTables } from '$lib/progression';
import { studioEdition } from '$lib/server/editions';
import { tableRows, editorNames, removeCampaign, revertCampaign, saveProgression, saveTable } from '$lib/server/studio-campaign';
import type { Actions, PageServerLoad } from './$types';

/** The Rules Editor's Campaign Phase: each table of the edition, its rows and their effects, and the progression settings. */
export const load: PageServerLoad = async ({ url, cookies }) => {
	const edition = await studioEdition({ url, cookies });
	const rows = await tableRows(edition);
	const progression = rows.find((r) => r.id === 'progression') ?? null;
	return {
		edition,
		tables: rows
			.filter((r) => r.id !== 'progression')
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(({ bookCopy, settings: _s, ...t }) => ({ ...t, revertible: !!bookCopy })),
		progression: progression && { settings: progression.settings, origin: progression.origin, revertible: !!progression.bookCopy },
		entry: url.searchParams.get('entry'),
		...(await editorNames(edition))
	};
};

type Errs = { path: string; message: string }[];

export const actions: Actions = {
	table: async ({ request, url, cookies }) => {
		const d = await request.formData();
		const s = (k: string) => String(d.get(k) ?? '').trim();
		const at = (k: string, i: number) => String(d.getAll(k)[i] ?? '').trim();
		// Each row posts its roll, name, text and effects (JSON) in order.
		const rows = d.getAll('r_roll').map((roll, i) => {
			let effects: unknown;
			try {
				effects = JSON.parse(at('r_effects', i));
			} catch {
				effects = undefined;
			}
			const has = effects && typeof effects === 'object' && Object.keys(effects).length;
			return { roll: String(roll).trim(), name: at('r_name', i), text: at('r_text', i), ...(has ? { effects } : {}) };
		});
		const errors: Errs = [];
		const id = s('id') || s('new_id');
		const [t] = readTables([{ id, name: s('name'), dice: s('dice'), source: s('source') || undefined, text: s('text'), rows }], (path, message) => errors.push({ path, message }));
		if (id === 'progression') errors.push({ path: 'id', message: 'is kept for the progression settings' });
		if (!t || errors.length) return fail(400, { errors, at: s('id') || 'new' });
		await saveTable(t, await studioEdition({ url, cookies }));
		return { saved: t.id };
	},

	progression: async ({ request, url, cookies }) => {
		const d = await request.formData();
		const s = (k: string) => String(d.get(k) ?? '').trim();
		const errors: Errs = [];
		const p = readProgression(
			{
				advancement_at: s('advancement_at')
					.split(/[\s,]+/)
					.filter(Boolean),
				promotion: { base_dice: s('base_dice'), per_glorious_deed: s('per_glorious_deed'), auto_after: s('auto_after'), max_elite: s('max_elite') },
				advancement: { tables_to_pick: s('tables_to_pick'), dice: s('dice') },
				text: s('text')
			},
			(path, message) => errors.push({ path, message })
		);
		if (!p || errors.length) return fail(400, { errors, at: 'progression' });
		await saveProgression(p, await studioEdition({ url, cookies }));
		return { saved: 'progression' };
	},

	revert: async ({ request, url, cookies }) => {
		const id = String((await request.formData()).get('id') ?? '');
		await revertCampaign('table', id, await studioEdition({ url, cookies }));
		return { saved: id };
	},

	remove: async ({ request, url, cookies }) => {
		const id = String((await request.formData()).get('id') ?? '');
		await removeCampaign('table', id, await studioEdition({ url, cookies }));
		return { removed: id };
	}
};
