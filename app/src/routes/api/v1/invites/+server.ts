import { json } from '@sveltejs/kit';
import { api, body } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import { inviteInput } from '#lib/schemas/auth';

/**
 * Pending invites.
 * Who: owners (all) and admins (their own).
 * In: nothing.
 * Out: 200 { items: Invite[] }
 * Errors: 401 unauthenticated, 403 forbidden for users.
 */
export const GET = api(async (_event, ctx) => ({ items: await invites.pending(ctx) }));

/**
 * Create an invite link; the link is shown only now.
 * Who: owners (admin or user invites) and admins (user invites).
 * In: { role, note? }
 * Out: 201 { invite, link }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden role not invitable or other site.
 */
export const POST = api(async (event, ctx) => {
	const { invite, link } = await invites.create(ctx, await body(event, inviteInput));
	return json({ invite, link }, { status: 201 });
});
