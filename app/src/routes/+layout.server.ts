import { customFactions } from '$lib/server/factions';
import { mapInfo } from '$lib/server/map';
import { ALL_ZONES } from '$lib/rules/zones';
import { env } from '$env/dynamic/private';
import { accessMode } from '$lib/server/access';
import type { LayoutServerLoad } from './$types';

/**
 * Authored factions and the campaign's map travel with every page, so the browser's lists match the server's; so
 * does who is signed in, which the navigation panel reads on every page (admin ones included).
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const u = locals.user;
	return {
		customFactions: await customFactions(),
		map: await mapInfo(),
		zones: [...ALL_ZONES],
		/** open (a LAN at the venue) or private (deployed: everything behind sign-in). */
		access: accessMode(env.ACCESS),
		user: u ? { username: u.username, name: u.displayName ?? u.username, role: u.role, warbandIds: u.warbandIds } : null
	};
};
