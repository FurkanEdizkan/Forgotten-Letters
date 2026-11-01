import { redirect } from '@sveltejs/kit';
import { ctxOf, formAction } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import * as rules from '#lib/server/services/rules';
import { homebrewCreate, homebrewImportForm } from '#lib/schemas/homebrew';
import { requireSignedIn } from '../guard';
import type { Actions, PageServerLoad } from './$types';

// The sets to build on, each with the factions and variants a new variant or copy may start from.
export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const [list, sets] = await Promise.all([homebrew.list(ctx), rules.sets(ctx, true)]);
	const byVersion = (a: { version: string | null }, b: { version: string | null }) =>
		(b.version ?? '').localeCompare(a.version ?? '', 'en', { numeric: true });
	const loaded = sets
		.filter((s) => s.ok)
		.sort((a, b) => (a.kind ?? '').localeCompare(b.kind ?? '') || byVersion(a, b));
	const bases = await Promise.all(
		loaded.map(async (s) => {
			const els = await rules.elements(ctx, s.id, ['faction', 'variant']);
			const pick = (type: string) =>
				els
					.filter((e) => e.type === type && e.id !== 'faction:mercenaries')
					.map((e) => ({ value: e.id, label: e.name }))
					.sort((a, b) => a.label.localeCompare(b.label));
			return {
				value: s.id,
				label:
					s.kind === 'homebrew'
						? `${s.name} (homebrew)`
						: `${s.name} ${s.version ?? ''}${s.base ? ` (on ${s.base})` : ''}`.trim(),
				factions: pick('faction'),
				variants: pick('variant')
			};
		})
	);
	return { ...list, bases };
};

export const actions = {
	/**
	 * Make a homebrew set and open its editor.
	 * Who: anyone signed in, on rules they can see.
	 * In: form homebrewCreate { name, base, start (faction, variant, items or copy), of? }.
	 * Out: redirect to /homebrew/<id>.
	 * Errors: 400 invalid, 401 unauthenticated, 404 not_found rules not loaded.
	 */
	create: async (event) => {
		const made = await formAction(event, homebrewCreate, (input, ctx) =>
			homebrew.create(ctx, input)
		);
		if ('id' in made) redirect(303, `/homebrew/${made.id}`);
		return made;
	},
	/**
	 * Import an exported homebrew file as a new set of mine and open it; refused with its problems if it fails its checks.
	 * Who: anyone signed in, on a base they can see.
	 * In: form { text } (the file's JSON).
	 * Out: redirect to /homebrew/<id>.
	 * Errors: 400 invalid not JSON or with problems, 401 unauthenticated, 404 not_found base not loaded.
	 */
	import: async (event) => {
		const made = await formAction(event, homebrewImportForm, (input, ctx) =>
			homebrew.importSet(ctx, input)
		);
		if ('id' in made) redirect(303, `/homebrew/${made.id}`);
		return made;
	}
} satisfies Actions;
