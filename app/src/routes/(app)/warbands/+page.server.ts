import { ctxOf, formAction } from '#lib/server/http';
import * as warbands from '#lib/server/services/warbands';
import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
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
	 * Import a Trench Companion text or a JSON export (ours or Trench Companion's) as a new warband; names that do
	 * not match are reported; games already played set the refund window and the next game (R1).
	 * Who: anyone signed in.
	 * In: form warbandImport { text, format (text | json), gamesPlayed?, rules (core or core+expansion) }.
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
		}),
	/**
	 * Copy one of my warbands from the list and open the copy.
	 * Who: the warband's owner.
	 * In: form { id }.
	 * Out: redirect to the copy.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	copy: async (event) => {
		let to = '';
		const r = await formAction(event, z.object({ id: z.uuid() }), async (input, ctx) => {
			to = (await warbands.copy(ctx, input.id)).id;
			return { op: 'copy', done: true };
		});
		if ('done' in r) redirect(303, `/warbands/${to}`);
		return r;
	},
	/**
	 * Delete one of my warbands from the list, for good.
	 * Who: the warband's owner.
	 * In: form { id }.
	 * Out: { op: 'remove', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
	 */
	remove: (event) =>
		formAction(event, z.object({ id: z.uuid() }), async (input, ctx) => {
			await warbands.remove(ctx, input.id);
			return { op: 'remove', done: true };
		})
} satisfies Actions;
