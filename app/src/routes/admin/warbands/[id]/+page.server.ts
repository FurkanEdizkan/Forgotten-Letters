import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { adjustment, game, player, warband } from '$lib/server/db/schema';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { removeImage, saveImage } from '$lib/server/uploads';
import { parseVision, parseWarbandForm } from '$lib/server/warbands';
import { buildGraph } from '$lib/rules/zones';
import { visionById, visionLevel } from '$lib/rules/visions';
import type { Actions, PageServerLoad } from './$types';

function find(id: string) {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const row = db
		.select({ warband, player })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(and(eq(warband.id, id), eq(warband.campaignId, c.id)))
		.get();
	if (!row) error(404, 'No such warband');
	return { c, ...row };
}

export const load: PageServerLoad = ({ params }) => {
	const { c, warband: w, player: p } = find(params.id);
	const { rows, state } = loadCampaignState(c);
	const s = state.players.get(w.id)!;
	const vision = visionById(w.visionCard ?? undefined);
	return {
		expectedPlayers: Math.max(c.expectedPlayers, rows.length),
		entryZones: [...buildGraph(c.houseZones).zones.values()].filter((z) => z.type === 'entry'),
		warband: w,
		player: p,
		games: s.games,
		vision: vision
			? {
					computed: !!vision.metric,
					level: visionLevel(state, s, vision.id, w.visionProgress),
					metric: vision.metric?.(state, s)
				}
			: null
	};
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const { c, warband: w, player: p } = find(params.id);
		const data = await request.formData();
		const { values, errors } = parseWarbandForm(data, c.houseZones);
		if (Object.keys(errors).length) return fail(400, { values, errors });

		let portrait = p.portrait;
		let symbol = w.symbol;
		try {
			const newPortrait = await saveImage(c.id, data.get('portrait'), 512);
			const newSymbol = await saveImage(c.id, data.get('symbol'), 256);
			if (newPortrait || data.has('clearPortrait')) {
				await removeImage(portrait);
				portrait = newPortrait;
			}
			if (newSymbol || data.has('clearSymbol')) {
				await removeImage(symbol);
				symbol = newSymbol;
			}
		} catch (e) {
			return fail(400, { values, errors: {}, message: (e as Error).message });
		}

		db.transaction((tx) => {
			tx.update(player)
				.set({ name: values.playerName, seat: values.seat, portrait })
				.where(eq(player.id, p.id))
				.run();
			tx.update(warband)
				.set({
					name: values.name,
					faction: values.faction,
					variant: values.variant,
					patron: values.patron,
					entryZone: values.entryZone,
					symbol
				})
				.where(eq(warband.id, w.id))
				.run();
		});
		return { saved: true };
	},

	vision: async ({ params, request }) => {
		const { warband: w } = find(params.id);
		db.update(warband)
			.set(parseVision(await request.formData()))
			.where(eq(warband.id, w.id))
			.run();
		return { visionSaved: true };
	},

	delete: async ({ params }) => {
		const { warband: w, player: p } = find(params.id);
		const played = db
			.select({ id: game.id })
			.from(game)
			.where(or(eq(game.aggressorId, w.id), eq(game.defenderId, w.id)))
			.get();
		if (played) return fail(400, { message: 'This warband has games recorded; it cannot be removed.' });
		db.transaction((tx) => {
			tx.delete(adjustment).where(eq(adjustment.warbandId, w.id)).run();
			tx.delete(warband).where(eq(warband.id, w.id)).run();
			tx.delete(player).where(eq(player.id, p.id)).run();
		});
		await removeImage(p.portrait);
		await removeImage(w.symbol);
		redirect(303, '/admin/warbands');
	}
};
