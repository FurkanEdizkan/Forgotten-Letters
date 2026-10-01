import { error } from '@sveltejs/kit';
import { currentCampaign } from '$lib/server/campaign';

export async function load({ cookies, locals }) {
	// The access gate refused this page (see hooks.server.ts): show it on the app's error page.
	if (locals.denied) error(locals.denied.status, locals.denied.message);
	return {
		campaign: (await currentCampaign()) ?? null,
		// The Campaign Master's console always opens beside the panel, never under it.
		navOpen: cookies.get('cf_nav') !== '0',
		navChosen: !!cookies.get('cf_nav')
	};
}
