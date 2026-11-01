import { redirect } from '@sveltejs/kit';
import { ctxOf, formAction, orPageError } from '#lib/server/http';
import * as homebrew from '#lib/server/services/homebrew';
import * as rules from '#lib/server/services/rules';
import { homebrewShareForm, homebrewUpdate } from '#lib/schemas/homebrew';
import { z } from 'zod';
import { requireSignedIn } from '../../guard';
import { withJsonField } from '../../campaigns/form';
import type { Actions, PageServerLoad } from './$types';

// The set, and what its base offers the pickers (keywords, items, factions, units) and the live checks (every id).
export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const h = await orPageError(event, homebrew.get(ctx, event.params.id));
	const els = await rules.elements(ctx, h.baseSet).catch(() => []);
	const of = (type: string) => els.filter((e) => e.type === type);
	const name = (e: { id: string; name: string }) => ({ id: e.id, name: e.name });
	return {
		homebrew: h,
		base: {
			loaded: els.length > 0,
			ids: els.map((e) => e.id),
			keywords: of('kw').map(name),
			items: of('item').map((e) => ({
				...name(e),
				category: String(e.data.category),
				type: String(e.data.type)
			})),
			factions: of('faction')
				.filter((e) => e.id !== 'faction:mercenaries')
				.map(name),
			units: of('unit').map((e) => ({ ...name(e), owner: String(e.data.owner) })),
			copiedFrom: h.copiedFrom
				? (els.find((e) => e.id === h.copiedFrom)?.name ?? h.copiedFrom)
				: null
		}
	};
};

export const actions = {
	/**
	 * Save the whole set (its data as one JSON field), with a version check; it is checked and re-indexed.
	 * Who: its maker.
	 * In: form homebrewUpdate { version, name?, data (JSON) }.
	 * Out: { op: 'save', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not its maker, 404 not_found, 409 conflict changed meanwhile.
	 */
	save: (event) =>
		formAction(event, withJsonField(homebrewUpdate, 'data'), async (input, ctx) => {
			await homebrew.update(ctx, event.params.id, input);
			return { op: 'save', done: true };
		}),
	/**
	 * Share the set with everyone here, or make it private again.
	 * Who: its maker.
	 * In: form { on: true|false }.
	 * Out: { op: 'share', done: true }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not its maker, 404 not_found, 409 conflict base private or in use by others.
	 */
	share: (event) =>
		formAction(event, homebrewShareForm, async ({ on }, ctx) => {
			await homebrew.share(ctx, event.params.id, on);
			return { op: 'share', done: true };
		}),
	/**
	 * Delete the set for good and go back to the list.
	 * Who: its maker; Owners.
	 * In: form {}.
	 * Out: redirect to /homebrew.
	 * Errors: 401 unauthenticated, 403 forbidden, 404 not_found, 409 conflict in use.
	 */
	remove: async (event) => {
		const out = await formAction(event, z.object({}), (_input, ctx) =>
			homebrew.remove(ctx, event.params.id).then(() => null)
		);
		if (out === null) redirect(303, '/homebrew');
		return out;
	}
} satisfies Actions;
