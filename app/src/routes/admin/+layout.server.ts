import { currentCampaign } from '$lib/server/campaign';

export async function load() {
	return { campaign: await currentCampaign() ?? null };
}
