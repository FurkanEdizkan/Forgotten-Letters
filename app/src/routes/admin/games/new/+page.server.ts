import { error, fail, redirect } from '@sveltejs/kit';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { BattleError, busyWarbands, planGame } from '$lib/server/games';
import { regionEventFor } from '$lib/server/fx';
import { trackerCvp } from '$lib/rules/engine';
import { suggestAggressor, zoneOptions } from '$lib/rules/legality';
import { weatherChooser } from '$lib/rules/weather';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const { rows, state } = await loadCampaignState(c);
	const busy = await busyWarbands(c.id);
	const warbands = rows.map(({ warband: w, player: p }) => {
		const s = state.players.get(w.id)!;
		return {
			id: w.id,
			name: w.name,
			player: p.name,
			seat: p.seat,
			portrait: p.portrait,
			symbol: w.symbol,
			faction: w.faction,
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
			(await Promise.all([...state.graph.zones.keys()].map(async (z) => [z, await regionEventFor(c.id, z)] as const))).filter(
				([, e]) => e
			)
		) as Record<string, number>,
		randomTurns: c.randomScenarioTurns,
		gamesPerPlayer: c.gamesPerPlayer
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const c = await currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const data = await request.formData();
		const s = (k: string) => String(data.get(k) ?? '');

		let weatherRolls: unknown = null;
		try {
			weatherRolls = JSON.parse(s('weatherRolls') || 'null');
		} catch {
			/* ignore malformed rolls */
		}
		let g;
		try {
			g = await planGame(c, {
				aggressor: s('aggressor'),
				defender: s('defender'),
				zone: s('zone'),
				override: data.has('override'),
				status: 'in_progress',
				scenario: s('scenario') || null,
				scenarioRandom: s('scenarioRandom') === 'true',
				weatherEvent: Number(s('weatherEvent')) || null,
				weatherRolls
			});
		} catch (e) {
			if (e instanceof BattleError) return fail(400, { message: e.message });
			throw e;
		}
		publish(c.id);
		redirect(303, `/admin/games/${g.id}`);
	}
};
