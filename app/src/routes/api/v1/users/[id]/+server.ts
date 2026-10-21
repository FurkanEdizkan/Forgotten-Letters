import { api, body, parse } from '#lib/server/http';
import * as people from '#lib/server/services/people';
import { idParam, userPatchInput } from '#lib/api-types';

/**
 * Change an account's role and/or disable or enable it.
 * Who: owners.
 * In: path id; { role?, disabled?, version }
 * Out: 200 Person
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not an owner or other site, 404 not_found, 409 conflict stale version, last owner or own account.
 */
export const PATCH = api(async (event, ctx) => {
	const { id } = parse(idParam, event.params);
	const input = await body(event, userPatchInput);
	let version = input.version;
	let person: people.Person | undefined;
	if (input.role !== undefined)
		version = (person = await people.changeRole(ctx, id, input.role, version)).version;
	if (input.disabled !== undefined)
		person = await people.setDisabled(ctx, id, input.disabled, version);
	return person;
});
