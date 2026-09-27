import { error, json } from '@sveltejs/kit';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { busyWarbands } from '$lib/server/games';
import { zoneOptions } from '$lib/rules/legality';

/**
 * Who could fight at a zone: for each free warband, whether the zone is legal for it
 * as Aggressor (against any opponent — Altar of Leviathan also checks the defender,
 * which the plan step re-validates).
 */
export async function GET({ url }) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const zone = url.searchParams.get('zone') ?? '';
	const { rows, state } = await loadCampaignState(c);
	if (!state.graph.zones.has(zone)) error(404, 'No such zone');
	const busy = await busyWarbands(c.id);
	const warbands = rows.map(({ warband: w, player: p }) => {
		const s = state.players.get(w.id)!;
		const other = rows.find((r) => r.warband.id !== w.id)?.warband.id ?? w.id;
		const option = zoneOptions(state, w.id, other).find((o) => o.zone === zone);
		return {
			id: w.id,
			player: p.name,
			name: w.name,
			seat: p.seat,
			busy: busy.has(w.id),
			games: s.games,
			aggressions: s.aggression.length,
			legal: !!option?.legal || (zone === 'altar-of-leviathan' && option?.reason !== 'Out of reach'),
			reason: option?.reason ?? null
		};
	});
	return json({ zone, gamesPerPlayer: c.gamesPerPlayer, warbands });
}
