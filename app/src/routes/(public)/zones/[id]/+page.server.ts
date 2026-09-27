import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { loreFor } from '$lib/server/lore';
import { buildGraph } from '$lib/rules/zones';
import { renderMarkdown } from '$lib/markdown';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	if (!buildGraph(c.houseZones).zones.has(params.id)) error(404, 'No such zone on this campaign’s map');
	const lore = await loreFor(c.id, params.id);
	const history = (await db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, c.id), eq(game.zone, params.id), eq(game.status, 'done')))
		.orderBy(desc(game.committedAt))
		)
		.map((g) => ({
			id: g.id,
			aggressor: g.aggressorId,
			defender: g.defenderId,
			winner: g.winnerId,
			scenario: g.scenario,
			weatherEvent: g.weatherEvent,
			at: (g.committedAt ?? g.createdAt).getTime()
		}));
	return { loreHtml: lore.lore ? renderMarkdown(lore.lore) : '', loreImage: lore.image, loreSource: lore.source, history };
};
