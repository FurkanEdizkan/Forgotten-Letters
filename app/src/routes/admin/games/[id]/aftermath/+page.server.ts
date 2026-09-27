import { fail } from '@sveltejs/kit';
import { findGame } from '$lib/server/games';
import { rosters } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { roster, saveUnit } from '$lib/server/roster';
import { buildGraph } from '$lib/rules/zones';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { c, g } = await findGame(params.id);
	const byId = new Map((await rosters(c.id)).map((r) => [r.warband.id, r]));
	const side = async (id: string) => {
		const r = byId.get(id);
		return { id, player: r?.player.name ?? '?', name: r?.warband.name ?? '?', units: (await roster(id)).units.filter((u) => u.status === 'active') };
	};
	return {
		game: { id: g.id, zone: buildGraph(c.houseZones).zones.get(g.zone)?.name ?? g.zone, winner: g.winnerId },
		sides: [await side(g.aggressorId), await side(g.defenderId)]
	};
};

/**
 * Post-game roster bookkeeping (injuries, deaths, experience, promotions, skills).
 * Kept apart from the tracker maths: these edit the rosters directly.
 */
export const actions: Actions = {
	update: async ({ params, request }) => {
		const { c, g } = await findGame(params.id);
		const data = await request.formData();
		const warbandId = String(data.get('warband'));
		if (![g.aggressorId, g.defenderId].includes(warbandId)) return fail(400, { message: 'Not in this game' });
		const unitId = String(data.get('unit'));
		const u = (await roster(warbandId)).units.find((x) => x.id === unitId);
		if (!u) return fail(404, { message: 'No such model' });
		const xp = Math.max(0, Math.round(Number(data.get('xp')) || 0));
		const injury = String(data.get('injury') ?? '').trim().slice(0, 120);
		const skill = String(data.get('skill') ?? '').trim().slice(0, 120);
		await saveUnit(warbandId, unitId, {
			experience: u.experience + xp,
			injuries: injury ? [...u.injuries, injury] : u.injuries,
			skills: skill ? [...u.skills, skill] : u.skills,
			category: data.has('promote') ? 'elite' : u.category,
			status: data.has('dead') ? 'dead' : u.status
		});
		publish(c.id);
		return { updated: u.name };
	}
};
