import { currentCampaign } from '$lib/server/campaign';

export function load() {
	return { campaign: currentCampaign() ?? null };
}
