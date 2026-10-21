import { z } from 'zod';
import { formAction, ctxOf } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import * as people from '#lib/server/services/people';
import { inviteInput } from '#lib/schemas/auth';
import { invitableBy } from '#lib/roles';
import type { Actions, PageServerLoad } from './$types';

const target = z.object({ id: z.string().uuid() });

export const load: PageServerLoad = async (event) => {
	const ctx = ctxOf(event);
	const me = ctx.actor!;
	// Owners manage every invite and person in the owner area; here they see only their own invites.
	const [pending, invited] = await Promise.all([
		invites.pending(ctx),
		me.role === 'owner' ? null : people.list(ctx, { limit: 100 })
	]);
	return {
		invites: pending.filter((i) => i.createdBy === me.id),
		invited: invited?.items ?? null,
		roles: invitableBy(me.role)
	};
};

export const actions = {
	/**
	 * Create an invite link; Campaign Masters invite users, owners also admins. The link is shown only now.
	 * Who: admins and owners.
	 * In: form { role: admin | user, note? }.
	 * Out: { op: 'create', link }.
	 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden role not invitable.
	 */
	create: (event) =>
		formAction(event, inviteInput, async (input, ctx) => {
			const { link } = await invites.create(ctx, input);
			return { op: 'create', link };
		}),
	/**
	 * Revoke one of my pending invites; its link stops working.
	 * Who: admins (their own invites) and owners.
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
	 * Re-send one of my invites: a fresh link with the same role and note; the old link stops working.
	 * Who: admins (their own invites) and owners.
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
