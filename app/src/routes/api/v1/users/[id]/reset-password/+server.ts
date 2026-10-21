import { api, body, parse } from '#lib/server/http';
import * as people from '#lib/server/services/people';
import { idParam, versionInput } from '#lib/api-types';

/**
 * Set a temporary password, returned once, and end the account's sessions.
 * Who: owners.
 * In: path id; { version }
 * Out: 200 { person, temporary }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not an owner or other site, 404 not_found, 409 conflict stale version.
 */
export const POST = api(async (event, ctx) => {
	const { id } = parse(idParam, event.params);
	const { version } = await body(event, versionInput);
	return people.resetPassword(ctx, id, version);
});
