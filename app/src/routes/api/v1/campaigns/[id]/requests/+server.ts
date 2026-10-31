import { json } from '@sveltejs/kit';
import { api, body, parse } from '#lib/server/http';
import * as requests from '#lib/server/services/join-requests';
import { requestInput } from '#lib/schemas/campaigns';
import { idParam } from '#lib/api-types';

/**
 * The open requests to join, oldest first.
 * Who: the CM and co-CMs.
 * In: path id.
 * Out: 200 { items: JoinRequest[] }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden, 404 not_found.
 */
export const GET = api(async (event, ctx) => ({
	items: await requests.listOpen(ctx, parse(idParam, event.params).id)
}));

/**
 * Ask to join: one open request at a time.
 * Who: anyone signed in without a seat; listed campaigns while mustering only.
 * In: path id; { note? }
 * Out: 201 JoinRequest
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not listed or other site, 404 not_found, 409 conflict a request is already open, already holds a seat or not mustering.
 */
export const POST = api(async (event, ctx) => {
	const { note } = await body(event, requestInput);
	return json(await requests.request(ctx, parse(idParam, event.params).id, note), {
		status: 201
	});
});
