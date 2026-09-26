import { currentCampaign } from '$lib/server/campaign';
import { publicSnapshot } from '$lib/server/public';

export function load() {
	const c = currentCampaign();
	return { snapshot: c ? publicSnapshot(c) : null };
}
