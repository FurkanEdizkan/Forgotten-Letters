import { AppError } from '#lib/server/errors';
import { api, parse } from '#lib/server/http';
import * as invites from '#lib/server/services/invites';
import { tokenParam } from '#lib/api-types';

/**
 * What an invite link offers: its state, role, note, inviter and expiry.
 * Who: anyone holding the link.
 * In: path token.
 * Out: 200 { state, role, note, inviter, expiresAt }
 * Errors: 400 invalid, 404 not_found unknown link.
 */
export const GET = api(
	async (event) => {
		const p = await invites.preview(parse(tokenParam, event.params).token);
		if (p.state === 'unknown') throw new AppError('not_found', 'This invite does not exist.');
		return p;
	},
	{ auth: false }
);
