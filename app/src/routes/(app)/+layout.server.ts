import { areasFor } from '#lib/roles';
import { requireSignedIn } from './guard';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	const u = requireSignedIn(event);
	// Only what the header needs; never the session hash.
	return {
		me: {
			id: u.id,
			username: u.username,
			displayName: u.displayName,
			role: u.role,
			mustChangePassword: u.mustChangePassword
		},
		areas: areasFor(u.role)
	};
};
