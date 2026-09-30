import { currentCampaign } from '$lib/server/campaign';
import { cachedPublicSnapshot } from '$lib/server/public';
import { navOpenFrom } from '$lib/nav';

export async function load({ locals, cookies, url }) {
	const c = await currentCampaign();
	const u = locals.user;
	return {
		snapshot: c ? await cachedPublicSnapshot(c) : null,
		isAdmin: locals.isAdmin,
		user: u ? { username: u.username, name: u.displayName ?? u.username, role: u.role, warbandIds: u.warbandIds } : null,
		navOpen: navOpenFrom(cookies.get('cf_nav'), url.pathname)
	};
}
