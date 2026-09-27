import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { currentCampaign, rosters } from '$lib/server/campaign';
import { buildGraph } from '$lib/rules/zones';
import { weatherByRoll } from '$lib/rules/weather';

export async function load() {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const zones = buildGraph(c.houseZones).zones;
	const byId = new Map((await rosters(c.id)).map((r) => [r.warband.id, r]));
	const who = (id: string | null) => {
		const r = id ? byId.get(id) : undefined;
		return r ? { id: r.warband.id, player: r.player.name, portrait: r.player.portrait, symbol: r.warband.symbol, faction: r.warband.faction } : null;
	};
	const games = (await db
		.select()
		.from(game)
		.where(eq(game.campaignId, c.id))
		.orderBy(desc(game.committedAt), desc(game.createdAt))
		)
		.map((g) => ({
			id: g.id,
			status: g.status,
			zone: zones.get(g.zone)?.name ?? g.zone,
			scenario: g.scenario,
			weather: g.weatherEvent ? weatherByRoll(g.weatherEvent)?.name : null,
			aggressor: who(g.aggressorId)!,
			defender: who(g.defenderId)!,
			winner: g.winnerId,
			committedAt: g.committedAt
		}));
	return {
		active: games.filter((g) => g.status !== 'done'),
		done: games.filter((g) => g.status === 'done')
	};
}
