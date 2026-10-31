import { json } from '@sveltejs/kit';
import { api, body, parse, setSessionCookie } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { seatAcceptInput } from '#lib/schemas/campaigns';
import { tokenParam } from '#lib/api-types';

/**
 * Take the seat a link offers: signed in with {}, or as a visitor with a new account (created and signed in).
 * Who: anyone holding the link.
 * In: path token; {} | { username, displayName, password }
 * Out: 201 { campaignId }, and a session cookie for a new account.
 * Errors: 400 invalid username taken or weak password, 401 unauthenticated no account sent, 403 forbidden other site, 404 not_found unknown, withdrawn or expired link, 409 conflict link used, seat taken, already holds a seat or joining closed, 429 rate_limited.
 */
export const POST = api(
	async (event, ctx) => {
		const { token } = parse(tokenParam, event.params);
		const r = await seats.accept(token, await body(event, seatAcceptInput), ctx);
		if (r.session) setSessionCookie(event, r.session);
		return json({ campaignId: r.campaignId }, { status: 201 });
	},
	{ auth: false }
);
