import { currentCampaign } from '$lib/server/campaign';

export async function load({ cookies }) {
	return {
		campaign: (await currentCampaign()) ?? null,
		// The Campaign Master's console always opens beside the panel, never under it.
		navOpen: cookies.get('cf_nav') !== '0'
	};
}
