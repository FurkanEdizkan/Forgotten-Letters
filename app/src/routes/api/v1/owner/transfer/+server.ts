import { api, body } from '#lib/server/http';
import * as people from '#lib/server/services/people';
import { ownerTransferInput } from '#lib/schemas/auth';

/**
 * Hand ownership to another active account; the Owner becomes an Admin (decision 80).
 * Who: the Owner.
 * In: { to, password, version } (version: the target account's row version).
 * Out: 200 { from: Person, to: Person }
 * Errors: 400 invalid bad shape or wrong password (fields.password), 401 unauthenticated, 403 forbidden not the Owner or other site, 404 not_found unknown account, 409 conflict target disabled, anonymised, yourself or stale version, 429 rate_limited.
 */
export const POST = api(async (event, ctx) =>
	people.transferOwnership(ctx, await body(event, ownerTransferInput))
);
