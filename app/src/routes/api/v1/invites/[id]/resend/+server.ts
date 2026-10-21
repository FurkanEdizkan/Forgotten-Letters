import { json } from '@sveltejs/kit';
import { api, parse } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import { idParam } from '#lib/api-types';

/**
 * Replace an invite with a fresh link for the same role and note; the old link stops working.
 * Who: owners (any invite) and admins (their own).
 * In: path id.
 * Out: 201 { invite, link }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden other site, 404 not_found, 409 conflict already used.
 */
export const POST = api(async (event, ctx) => {
	const { invite, link } = await invites.resend(ctx, parse(idParam, event.params).id);
	return json({ invite, link }, { status: 201 });
});
