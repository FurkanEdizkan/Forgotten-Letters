import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { adjustment, game, player, user, warband } from '$lib/server/db/schema';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { removeImage, saveImage } from '$lib/server/uploads';
import { parseVision, parseWarbandForm } from '$lib/server/warbands';
import { buildGraph } from '$lib/rules/zones';
import { visionById, visionLevel } from '$lib/rules/visions';
import { deleteWarbandModels, listModels } from '$lib/server/models';
import { roster } from '$lib/server/roster';
import { rosterTotals } from '$lib/roster';
import type { Actions, PageServerLoad } from './$types';

/** Models for this warband and its faction's defaults, without the private STL path. */
async function modelsFor(campaignId: string, warbandId: string, faction: string) {
	const pick = async (kind: 'outpost' | 'figure', ownerType: 'warband' | 'faction', ownerId: string) => {
		const m = (await listModels(campaignId)).find((m) => m.kind === kind && m.ownerType === ownerType && m.ownerId === ownerId);
		return m ? { id: m.id, token: m.token, hasStl: !!m.stl, params: m.params } : null;
	};
	return {
		outpost: await pick('outpost', 'warband', warbandId),
		figure: await pick('figure', 'warband', warbandId),
		factionOutpost: await pick('outpost', 'faction', faction),
		factionFigure: await pick('figure', 'faction', faction)
	};
}

async function find(id: string) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const row = (await db
		.select({ warband, player })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(and(eq(warband.id, id), eq(warband.campaignId, c.id)))
		)[0];
	if (!row) error(404, 'No such warband');
	return { c, ...row };
}

/** Ducats tied up in the roster (models, their kit and the arsenal). */
async function spent(warbandId: string) {
	const { units, stash } = await roster(warbandId);
	return rosterTotals(units, stash).ducats;
}

export const load: PageServerLoad = async ({ params }) => {
	const { c, warband: w, player: p } = await find(params.id);
	const { rows, state } = await loadCampaignState(c);
	const s = state.players.get(w.id)!;
	const vision = visionById(w.visionCard ?? undefined);
	return {
		expectedPlayers: Math.max(c.expectedPlayers, rows.length),
		entryZones: [...buildGraph(c.houseZones).zones.values()].filter((z) => z.type === 'entry'),
		warband: w,
		player: p,
		games: s.games,
		spent: await spent(w.id),
		models: await modelsFor(c.id, w.id, w.faction),
		account: p.userId ? ((await db.select({ username: user.username, disabled: user.disabled }).from(user).where(eq(user.id, p.userId)))[0] ?? null) : null,
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
		const { c, warband: w, player: p } = await find(params.id);
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

		await db.transaction(async (tx) => {
			(await tx.update(player)
				.set({ name: values.playerName, seat: values.seat, portrait })
				.where(eq(player.id, p.id))
				);
			(await tx.update(warband)
				.set({
					name: values.name,
					faction: values.faction,
					variant: values.variant,
					patron: values.patron,
					entryZone: values.entryZone,
					symbol
				})
				.where(eq(warband.id, w.id))
				);
		});
		return { saved: true };
	},

	vision: async ({ params, request }) => {
		const { warband: w } = await find(params.id);
		(await db.update(warband)
			.set(parseVision(await request.formData()))
			.where(eq(warband.id, w.id))
			);
		return { visionSaved: true };
	},

	display: async ({ params, request }) => {
		const { warband: w } = await find(params.id);
		const mode = String((await request.formData()).get('displayModel'));
		(await db.update(warband)
			.set({ displayModel: mode === 'model' ? 'model' : 'portrait' })
			.where(eq(warband.id, w.id))
			);
		publish(w.campaignId);
		return { displaySaved: true };
	},

	/** Give a warband that started at 0 its 700 starting Ducats, less what its roster already cost. */
	strongbox: async ({ params }) => {
		const { c, warband: w } = await find(params.id);
		const ducats = 700 - (await spent(w.id));
		await db.update(warband).set({ treasuryDucats: ducats }).where(eq(warband.id, w.id));
		publish(c.id);
		return { strongbox: ducats };
	},

	delete: async ({ params }) => {
		const { c, warband: w, player: p } = await find(params.id);
		const played = (await db
			.select({ id: game.id })
			.from(game)
			.where(or(eq(game.aggressorId, w.id), eq(game.defenderId, w.id)))
			)[0];
		if (played) return fail(400, { message: 'This warband has games recorded; it cannot be removed.' });
		await db.transaction(async (tx) => {
			(await tx.delete(adjustment).where(eq(adjustment.warbandId, w.id)));
			(await tx.delete(warband).where(eq(warband.id, w.id)));
			(await tx.delete(player).where(eq(player.id, p.id)));
		});
		await removeImage(p.portrait);
		await removeImage(w.symbol);
		for (const f of [w.seal?.custom?.base, w.seal?.custom?.light, w.seal?.custom?.source]) await removeImage(f);
		await deleteWarbandModels(c.id, w.id);
		redirect(303, '/admin/warbands');
	}
};
