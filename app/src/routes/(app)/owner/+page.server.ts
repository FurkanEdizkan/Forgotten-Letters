import { z } from 'zod';
import { formAction, ctxOf } from '#lib/server/http';
import * as people from '#lib/server/services/people';
import { pageQuery, roleInput } from '#lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';

const target = z.object({ id: z.string().uuid(), version: z.coerce.number().int().min(1) });

export const load: PageServerLoad = async (event) => {
	const q = pageQuery.parse({
		after: event.url.searchParams.get('after') ?? undefined,
		limit: 100
	});
	return { people: await people.list(ctxOf(event), q), after: q.after ?? null };
};

export const actions = {
	/**
	 * Change a person's role; the last owner can never be demoted.
	 * Who: owners.
	 * In: form { id, version, role }.
	 * Out: { op: 'role', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict last owner or stale version.
	 */
	role: (event) =>
		formAction(event, target.merge(roleInput), async ({ id, version, role }, ctx) => {
			await people.changeRole(ctx, id, role, version);
			return { op: 'role', id, done: true };
		}),
	/**
	 * Disable an account: it is signed out everywhere and cannot sign in; its history stays.
	 * Who: owners (never their own account or the last owner).
	 * In: form { id, version }.
	 * Out: { op: 'disable', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict last owner, self or stale version.
	 */
	disable: (event) =>
		formAction(event, target, async ({ id, version }, ctx) => {
			await people.setDisabled(ctx, id, true, version);
			return { op: 'disable', id, done: true };
		}),
	/**
	 * Enable a disabled account again.
	 * Who: owners.
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
	 * Who: owners.
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
	 * Who: owners.
	 * In: form { id, version }.
	 * Out: { op: 'anonymise', id, done: true }.
	 * Errors: 400 invalid, 403 forbidden, 404 not_found, 409 conflict not disabled or stale version.
	 */
	anonymise: (event) =>
		formAction(event, target, async ({ id, version }, ctx) => {
			await people.anonymise(ctx, id, version);
			return { op: 'anonymise', id, done: true };
		})
} satisfies Actions;
