import { customFactions } from '$lib/server/factions';
import { mapInfo } from '$lib/server/map';
import { ALL_ZONES } from '$lib/rules/zones';
import type { LayoutServerLoad } from './$types';

/**
 * Travels with every page: the signed-in user (so the navigation panel is the same on public and admin pages),
 * authored factions and the campaign's map (so the browser's lists match the server's).
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const u = locals.user;
	return {
		user: u ? { username: u.username, name: u.displayName ?? u.username, role: u.role, warbandIds: u.warbandIds } : null,
		customFactions: await customFactions(),
		map: await mapInfo(),
		zones: [...ALL_ZONES]
	};
};
