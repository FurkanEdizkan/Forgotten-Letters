import { currentCampaign } from '$lib/server/campaign';
import { cachedPublicSnapshot } from '$lib/server/public';
import { navOpenFrom } from '$lib/nav';

export async function load({ locals, cookies, url }) {
	const c = await currentCampaign();
	return {
		snapshot: c ? await cachedPublicSnapshot(c) : null,
		isAdmin: locals.isAdmin,
		navOpen: navOpenFrom(cookies.get('cf_nav'), url.pathname)
	};
}
