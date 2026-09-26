import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { regionEventFor } from '$lib/server/fx';
import { trackerCvp } from '$lib/rules/engine';
import { suggestAggressor, zoneOptions } from '$lib/rules/legality';
import { weatherByRoll, weatherChooser } from '$lib/rules/weather';
import type { Actions, PageServerLoad } from './$types';

/** Warbands already on the field in a game that isn't recorded yet. */
function busyWarbands(campaignId: string) {
	const busy = new Set<string>();
	for (const g of db.select().from(game).where(and(eq(game.campaignId, campaignId), ne(game.status, 'done'))).all()) {
		busy.add(g.aggressorId);
		busy.add(g.defenderId);
	}
	return busy;
}

export const load: PageServerLoad = ({ url }) => {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const { rows, state } = loadCampaignState(c);
	const busy = busyWarbands(c.id);
	const warbands = rows.map(({ warband: w, player: p }) => {
		const s = state.players.get(w.id)!;
		return {
			id: w.id,
			name: w.name,
			player: p.name,
			seat: p.seat,
			portrait: p.portrait,
			symbol: w.symbol,
			games: s.games,
			busy: busy.has(w.id),
			aggressorCount: s.aggression.length,
			cvp: trackerCvp(s)
		};
	});

	const a = url.searchParams.get('a');
	const b = url.searchParams.get('b');
	const pair = a && b && a !== b && state.players.has(a) && state.players.has(b) ? { a, b } : null;
	let matchup = null;
	if (pair) {
		const suggested = suggestAggressor(state, pair.a, pair.b);
		const aggressor = url.searchParams.get('agg') ?? suggested ?? pair.a;
		const defender = aggressor === pair.a ? pair.b : pair.a;
		const cvp = (id: string) => trackerCvp(state.players.get(id)!);
		matchup = {
			suggested,
			aggressor,
			defender,
			zones: zoneOptions(state, aggressor, defender),
			weatherChooser: weatherChooser({ id: aggressor, cvp: cvp(aggressor) }, { id: defender, cvp: cvp(defender) })
		};
	}
	return {
		warbands,
		pair,
		matchup,
		zones: [...state.graph.zones.values()],
		regionEvents: Object.fromEntries(
			[...state.graph.zones.keys()].map((z) => [z, regionEventFor(c.id, z)]).filter(([, e]) => e)
		) as Record<string, number>,
		randomTurns: c.randomScenarioTurns,
		gamesPerPlayer: c.gamesPerPlayer
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const c = currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const { state } = loadCampaignState(c);
		const data = await request.formData();
		const s = (k: string) => String(data.get(k) ?? '');

		const aggressor = s('aggressor');
		const defender = s('defender');
		const zone = s('zone');
		if (!state.players.has(aggressor) || !state.players.has(defender) || aggressor === defender)
			return fail(400, { message: 'Choose two different warbands' });
		const busy = busyWarbands(c.id);
		if (busy.has(aggressor) || busy.has(defender))
			return fail(400, { message: 'One of these warbands is already on the field — record or cancel that game first.' });
		const spent = [aggressor, defender].filter((id) => state.players.get(id)!.games >= c.gamesPerPlayer);
		if (spent.length && !data.has('override'))
			return fail(400, {
				message: `Already played all ${c.gamesPerPlayer} campaign games. Tick "override" to allow an extra game.`
			});
		const option = zoneOptions(state, aggressor, defender).find((o) => o.zone === zone);
		if (!option) return fail(400, { message: 'Choose a zone' });
		if (!option.legal && !data.has('override'))
			return fail(400, { message: `${zone}: ${option.reason}. Tick "override" to allow it anyway.` });

		const weatherEvent = Number(s('weatherEvent'));
		let weatherRolls: unknown = null;
		try {
			weatherRolls = JSON.parse(s('weatherRolls') || 'null');
		} catch {
			/* ignore malformed rolls */
		}

		const g = db
			.insert(game)
			.values({
				campaignId: c.id,
				status: 'in_progress',
				zone,
				aggressorId: aggressor,
				defenderId: defender,
				scenario: s('scenario') || null,
				weatherEvent: weatherByRoll(weatherEvent) ? weatherEvent : null,
				weatherRolls,
				result: { sides: {}, scenarioRandom: s('scenarioRandom') === 'true' }
			})
			.returning()
			.get();
		publish(c.id);
		redirect(303, `/admin/games/${g.id}`);
	}
};
