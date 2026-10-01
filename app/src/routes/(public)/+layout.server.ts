import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';
import { cachedPublicSnapshot } from '$lib/server/public';
import { navOpenFrom } from '$lib/nav';

export async function load({ locals, cookies, url }) {
	// The access gate refused this page (see hooks.server.ts): show it on the app's error page.
	if (locals.denied) error(locals.denied.status, locals.denied.message);
	const c = await currentCampaign();
	return {
		snapshot: c ? await cachedPublicSnapshot(c) : null,
		isAdmin: locals.isAdmin,
		navOpen: navOpenFrom(cookies.get('cf_nav'), url.pathname),
		navChosen: !!cookies.get('cf_nav')
	};
}
