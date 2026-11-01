import { ctxOf, formAction } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { warbandImport } from '#lib/schemas/warbands';
import { requireSignedIn } from '../guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const [mine, choices] = await Promise.all([warbands.listMine(ctx), warbands.choices(ctx)]);
	return { warbands: mine, rules: choices.rules };
};

export const actions = {
	/**
	 * Import a Trench Companion text export as a new warband; names that do not match are reported.
	 * Who: anyone signed in.
	 * In: form warbandImport { text, rules (core or core+expansion) }.
	 * Out: { op: 'import', done: true, id, name, unmatched, ambiguous }.
	 * Errors: 400 invalid not a warband, 401 unauthenticated, 404 not_found rules not loaded, 409 conflict no rules.
	 */
	import: (event) =>
		formAction(event, warbandImport, async (input, ctx) => {
			const r = await warbands.importText(ctx, input);
			return {
				op: 'import',
				done: true,
				id: r.warband.id,
				name: r.warband.name,
				unmatched: r.unmatched,
				ambiguous: r.ambiguous
			};
		})
} satisfies Actions;
