import { ctxOf } from '#lib/server/http';
import * as campaigns from '#lib/server/services/campaigns';
import type { ApiCampaignCard } from '#lib/api-types';
import { PANEL_CAMPAIGNS, shellData } from '#lib/ui/shell/nav';
import { requireSignedIn } from './guard';
import type { LayoutServerLoad } from './$types';

// Only what the shell needs (shellData picks the fields); never the session hash. Your campaigns feed the side
// panel and /home: one more than the panel shows, so it knows whether "All campaigns…" hides more.
export const load: LayoutServerLoad = async (event) => {
	const user = requireSignedIn(event);
	const mine: ApiCampaignCard[] = user.mustChangePassword
		? []
		: (await campaigns.list(ctxOf(event), { scope: 'mine', limit: PANEL_CAMPAIGNS + 1 })).items;
	return { ...shellData(user), campaigns: mine };
};
