import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { campaign, game, warband } from '$lib/server/db/schema';
import { ADMIN_COOKIE } from '$lib/server/auth';
import { currentCampaign, loadCampaignState } from '$lib/server/campaign';
import { standings } from '$lib/rules/scoring';
import { visionById } from '$lib/rules/visions';
import { publish } from '$lib/server/hub';
import { ALL_ZONES } from '$lib/rules/zones';
import { EXTENDED_MAX_PLAYERS } from '$lib/seating';
import type { Actions } from './$types';

function settings(data: FormData) {
	const int = (k: string, min: number, max: number, dflt: number) => {
		const n = Number(data.get(k));
		return Number.isInteger(n) && n >= min && n <= max ? n : dflt;
	};
	const scoring = String(data.get('gloryScoring'));
	return {
		name: String(data.get('name') ?? '').trim() || 'Carcass Front',
		gamesPerPlayer: int('gamesPerPlayer', 1, 12, 8),
		expectedPlayers: int('expectedPlayers', 2, EXTENDED_MAX_PLAYERS, 8),
		randomScenarioTurns: int('randomScenarioTurns', 1, 10, 4),
		gloryScoring: (['boxIndex', 'deeds', 'none'].includes(scoring) ? scoring : 'boxIndex') as
			| 'boxIndex'
			| 'deeds'
			| 'none',
		houseZones: data.has('houseZones'),
		houseRazing: data.has('houseRazing'),
		houseOutpostLevy: data.has('houseOutpostLevy')
	};
}

/** CM-only preview of the final reckoning, Visions included. */
export function load() {
	const c = currentCampaign();
	if (!c) return { reckoning: null };
	const { rows, infos, state } = loadCampaignState(c);
	const byId = new Map(rows.map((r) => [r.warband.id, r]));
	return {
		reckoning: standings(state, infos, { revealVisions: true, final: true }).map((s) => {
			const r = byId.get(s.id)!;
			return {
				...s,
				player: r.player.name,
				warband: r.warband.name,
				vision: visionById(r.warband.visionCard ?? undefined)?.name ?? null
			};
		})
	};
}

export const actions: Actions = {
	create: async ({ request }) => {
		if (currentCampaign()) return fail(400, { message: 'A campaign already exists' });
		db.insert(campaign).values(settings(await request.formData())).run();
		return { saved: true };
	},
	update: async ({ request }) => {
		const c = currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const data = await request.formData();
		const next = settings(data);
		if (c.houseZones && !next.houseZones) {
			// House zones can't be switched off while warbands start in E/F or games were fought there.
			const house = ALL_ZONES.filter((z) => z.house).map((z) => z.id);
			const usedBy =
				db.select({ id: warband.id }).from(warband)
					.where(and(eq(warband.campaignId, c.id), inArray(warband.entryZone, house))).get() ??
				db.select({ id: game.id }).from(game)
					.where(and(eq(game.campaignId, c.id), or(inArray(game.zone, house)))).get();
			if (usedBy) return fail(400, { message: 'House zones are in use (Entry Zones E/F or games in zones 1–6); move those warbands first.' });
		}
		db.update(campaign)
			.set({ ...next, visionsRevealed: data.has('visionsRevealed') })
			.where(eq(campaign.id, c.id))
			.run();
		publish(c.id);
		return { saved: true };
	},
	logout: async ({ cookies }) => {
		cookies.delete(ADMIN_COOKIE, { path: '/' });
		redirect(303, '/');
	}
};
