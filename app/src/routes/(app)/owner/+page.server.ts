import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { formAction, ctxOf, setFlash } from '#lib/server/http';
import * as people from '#lib/server/services/people';
import { ownerTransferInput, pageQuery, roleInput } from '#lib/schemas/auth';
import { candidatesQuery } from '#lib/schemas/campaigns';
import type { Actions, PageServerLoad } from './$types';

const target = z.object({ id: z.string().uuid(), version: z.coerce.number().int().min(1) });

export const load: PageServerLoad = async (event) => {
	const ctx = ctxOf(event);
	const q = pageQuery.parse({
		after: event.url.searchParams.get('after') ?? undefined,
		limit: 100
	});
	// The Transfer ownership panel searches through the page's own query, so it works without scripts.
	const find = candidatesQuery.safeParse({ q: event.url.searchParams.get('find') ?? '' });
	const [list, candidates] = await Promise.all([
		people.list(ctx, q),
		find.success ? people.ownerCandidates(ctx, find.data.q) : []
	]);
	return {
		people: list,
		after: q.after ?? null,
		find: find.success ? find.data.q : '',
		candidates
	};
};

export const actions = {
	/**
	 * Change a person's role to Admin or User; the Owner's role changes only by transfer.
	 * Who: the Owner.
	 * In: form { id, version, role: admin | user }.
	 * Out: { op: 'role', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict the target is the Owner or stale version.
	 */
	role: (event) =>
		formAction(event, target.merge(roleInput), async ({ id, version, role }, ctx) => {
			await people.changeRole(ctx, id, role, version);
			return { op: 'role', id, done: true };
		}),
	/**
	 * Disable an account: it is signed out everywhere and cannot sign in; its history stays.
	 * Who: the Owner (never the Owner's own account).
	 * In: form { id, version }.
	 * Out: { op: 'disable', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict the Owner, CM of a campaign or stale version.
	 */
	disable: (event) =>
		formAction(event, target, async ({ id, version }, ctx) => {
			await people.setDisabled(ctx, id, true, version);
			return { op: 'disable', id, done: true };
		}),
	/**
	 * Enable a disabled account again.
	 * Who: the Owner.
	 * In: form { id, version }.
	 * Out: { op: 'enable', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict stale version.
	 */
	enable: (event) =>
		formAction(event, target, async ({ id, version }, ctx) => {
			await people.setDisabled(ctx, id, false, version);
			return { op: 'enable', id, done: true };
		}),
	/**
	 * Reset a password to a temporary one, shown once, to be changed at the next sign-in.
	 * Who: the Owner.
	 * In: form { id, version }.
	 * Out: { op: 'reset', id, done: true, temporary }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict stale version.
	 */
	reset: (event) =>
		formAction(event, target, async ({ id, version }, ctx) => {
			const { temporary } = await people.resetPassword(ctx, id, version);
			return { op: 'reset', id, done: true, temporary };
		}),
	/**
	 * Anonymise a disabled account: its display name becomes "Former member".
	 * Who: the Owner (never the Owner's own account).
	 * In: form { id, version }.
	 * Out: { op: 'anonymise', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict the Owner, not disabled or stale version.
	 */
	anonymise: (event) =>
		formAction(event, target, async ({ id, version }, ctx) => {
			await people.anonymise(ctx, id, version);
			return { op: 'anonymise', id, done: true };
		}),
	/**
	 * Hand ownership to another active account; you become an Admin ("Campaign Master").
	 * Who: the Owner, with their password.
	 * In: form ownerTransferInput { to, password, version (the target's row version) }.
	 * Out: 303 to /admin, which names the new Owner once.
	 * Errors: 400 invalid wrong password (fields.password), 401 unauthenticated, 403 forbidden, 404 not_found, 409
	 * conflict target disabled, anonymised, yourself or stale version, 429 rate_limited.
	 */
	transfer: (event) =>
		formAction(event, ownerTransferInput, async (input, ctx) => {
			const { to } = await people.transferOwnership(ctx, input);
			setFlash(event, '/admin', to.displayName);
			redirect(303, '/admin');
		})
} satisfies Actions;
