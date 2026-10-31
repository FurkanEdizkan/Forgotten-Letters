import { AppError } from '#lib/server/errors';
import { api, parse } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { tokenParam } from '#lib/api-types';

/**
 * What a seat link offers: its state, the campaign, the seat and the expiry.
 * Who: anyone holding the link.
 * In: path token.
 * Out: 200 SeatInvitePreview
 * Errors: 400 invalid, 404 not_found unknown link.
 */
export const GET = api(
	async (event) => {
		const p = await seats.preview(parse(tokenParam, event.params).token);
		if (p.state === 'unknown') throw new AppError('not_found', 'This seat link does not exist.');
		return p;
	},
	{ auth: false }
);
