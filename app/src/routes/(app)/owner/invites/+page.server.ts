import { z } from 'zod';
import { formAction, ctxOf } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import * as people from '#lib/server/services/people';
import { inviteInput } from '#lib/schemas/auth';
import type { Actions, PageServerLoad } from './$types';

const target = z.object({ id: z.string().uuid() });

export const load: PageServerLoad = async (event) => {
	const ctx = ctxOf(event);
	const [pending, everyone] = await Promise.all([
		invites.pending(ctx),
		people.list(ctx, { limit: 100 })
	]);
	return {
		invites: pending,
		names: Object.fromEntries(everyone.items.map((p) => [p.id, p.displayName]))
	};
};

export const actions = {
	/**
	 * Create an invite link for an admin or a user; the link is shown only now.
	 * Who: owners.
	 * In: form { role: admin | user, note? }.
	 * Out: { op: 'create', link }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden.
	 */
	create: (event) =>
		formAction(event, inviteInput, async (input, ctx) => {
			const { link } = await invites.create(ctx, input);
			return { op: 'create', link };
		}),
	/**
	 * Revoke a pending invite; its link stops working.
	 * Who: owners (any invite).
	 * In: form { id }.
	 * Out: { op: 'revoke', id }.
	 * Errors: 400 invalid, 404 not_found, 409 conflict already used.
	 */
	revoke: (event) =>
		formAction(event, target, async ({ id }, ctx) => {
			await invites.revoke(ctx, id);
			return { op: 'revoke', id };
		}),
	/**
	 * Re-send an invite: a fresh link with the same role and note; the old link stops working.
	 * Who: owners (any invite).
	 * In: form { id }.
	 * Out: { op: 'resend', id, link }.
	 * Errors: 400 invalid, 404 not_found, 409 conflict already used.
	 */
	resend: (event) =>
		formAction(event, target, async ({ id }, ctx) => {
			const { link } = await invites.resend(ctx, id);
			return { op: 'resend', id, link };
		})
} satisfies Actions;
