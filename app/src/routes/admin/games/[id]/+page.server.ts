import { fail, redirect } from '@sveltejs/kit';
import { afterGameRecorded } from '$lib/server/rounds';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { game } from '$lib/server/db/schema';
import { rosters, type GameResult } from '$lib/server/campaign';
import { commitGame, findGame, parseDraft, previewGame } from '$lib/server/games';
import { publish } from '$lib/server/hub';
import { announceResult, tickRegions } from '$lib/server/fx';
import { roster } from '$lib/server/roster';
import { buildGraph } from '$lib/rules/zones';
import { weatherByRoll } from '$lib/rules/weather';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { c, g } = await findGame(params.id);
	const graph = buildGraph(c.houseZones);
	const byId = new Map((await rosters(c.id)).map((r) => [r.warband.id, r]));
	const side = (id: string) => {
		const r = byId.get(id);
		return {
			id,
			name: r?.warband.name ?? '?',
			player: r?.player.name ?? '?',
			portrait: r?.player.portrait ?? null,
			symbol: r?.warband.symbol ?? null,
			faction: r?.warband.faction ?? null
		};
	};
	const result = (g.result ?? { sides: {} }) as GameResult;
	const blank = { winner: null, sides: {} };
	const preview = await previewGame(c, g, { ...blank, sides: result.sides, winner: g.winnerId });
	return {
		game: {
			id: g.id,
			status: g.status,
			zone: g.zone,
			scenario: g.scenario,
			weather: g.weatherEvent ? weatherByRoll(g.weatherEvent) : null,
			committedAt: g.committedAt
		},
		razing: c.houseRazing,
		zone: graph.zones.get(g.zone)!,
		zones: [...graph.zones.values()],
		aggressor: await side(g.aggressorId),
		defender: await side(g.defenderId),
		saved: { winner: g.winnerId, sides: result.sides },
		preview
	};
};

export const actions: Actions = {
	commit: async ({ params, request }) => {
		const { c, g } = await findGame(params.id);
		const data = await request.formData();
		let raw: unknown;
		try {
			raw = JSON.parse(String(data.get('draft') ?? ''));
		} catch {
			return fail(400, { message: 'Malformed result' });
		}
		const draft = parseDraft(raw, g);
		if (!draft) return fail(400, { message: 'Malformed result' });
		const { pending } = await previewGame(c, g, draft);
		if (pending.length && !data.has('force'))
			return fail(400, { message: `${pending.length} reward choice(s) still unresolved.` });
		const firstCommit = g.status !== 'done' && !g.committedAt;
		await commitGame(g, draft);
		if (firstCommit) await tickRegions(c.id, g.zone);
		publish(c.id);
		// Every open map plays the result: the fallen, then the winner's monument.
		await announceResult(c, g.id);
		// The last battle of a round closes it and opens the next.
		if (firstCommit) await afterGameRecorded(c, g.id);
		// On to the roster aftermath (injuries, promotions) when either side keeps a roster.
		const hasRoster = (await Promise.all([g.aggressorId, g.defenderId].map(roster))).some((r) => r.units.length);
		redirect(303, hasRoster ? `/admin/games/${g.id}/aftermath` : '/admin/games');
	},

	reopen: async ({ params }) => {
		const { c, g } = await findGame(params.id);
		// Keep committedAt so the game replays in its original place once recommitted.
		(await db.update(game).set({ status: 'in_progress' }).where(eq(game.id, g.id)));
		publish(c.id);
		return { reopened: true };
	},

	delete: async ({ params }) => {
		const { c, g } = await findGame(params.id);
		(await db.delete(game).where(eq(game.id, g.id)));
		publish(c.id);
		redirect(303, '/admin/games');
	}
};
