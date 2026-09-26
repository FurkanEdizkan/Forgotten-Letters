import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { player, warband } from '$lib/server/db/schema';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { saveImage } from '$lib/server/uploads';
import { parseWarbandForm } from '$lib/server/warbands';
import { trackerCvp } from '$lib/rules/engine';
import { buildGraph } from '$lib/rules/zones';
import type { Actions } from './$types';

export function load() {
	const c = currentCampaign();
	if (!c) error(404, 'Found a campaign first');
	const { rows, state } = loadCampaignState(c);
	const zones = buildGraph(c.houseZones).zones;
	return {
		expectedPlayers: Math.max(c.expectedPlayers, rows.length),
		entryZones: [...zones.values()].filter((z) => z.type === 'entry'),
		warbands: rows.map(({ warband: w, player: p }) => {
			const s = state.players.get(w.id)!;
			return {
				id: w.id,
				name: w.name,
				faction: w.faction,
				variant: w.variant,
				entryZone: w.entryZone,
				entryName: zones.get(w.entryZone)?.name ?? w.entryZone,
				symbol: w.symbol,
				hasVision: !!w.visionCard,
				player: { name: p.name, seat: p.seat, portrait: p.portrait },
				games: s.games,
				cvp: trackerCvp(s)
			};
		})
	};
}

export const actions: Actions = {
	create: async ({ request }) => {
		const c = currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const data = await request.formData();
		const { values, errors } = parseWarbandForm(data, c.houseZones);
		if (Object.keys(errors).length) return fail(400, { values, errors });

		let portrait: string | null, symbol: string | null;
		try {
			portrait = await saveImage(c.id, data.get('portrait'), 512);
			symbol = await saveImage(c.id, data.get('symbol'), 256);
		} catch (e) {
			return fail(400, { values, errors: {}, message: (e as Error).message });
		}

		db.transaction((tx) => {
			const p = tx
				.insert(player)
				.values({ campaignId: c.id, name: values.playerName, seat: values.seat, portrait })
				.returning()
				.get();
			tx.insert(warband)
				.values({
					campaignId: c.id,
					playerId: p.id,
					name: values.name,
					faction: values.faction,
					variant: values.variant,
					patron: values.patron,
					entryZone: values.entryZone,
					symbol
				})
				.run();
		});
		return { created: values.name };
	}
};
