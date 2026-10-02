import { fail } from '@sveltejs/kit';
import { findGame } from '$lib/server/games';
import { rosters } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { roster, saveUnit } from '$lib/server/roster';
import { buildGraph } from '$lib/rules/zones';
import { approve, reportFor, saveLines } from '$lib/server/aftermath';
import { db } from '$lib/server/db';
import { aftermathReport } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { c, g } = await findGame(params.id);
	const byId = new Map((await rosters(c.id)).map((r) => [r.warband.id, r]));
	const side = async (id: string) => {
		const r = byId.get(id);
		const [report] = await db.select().from(aftermathReport).where(and(eq(aftermathReport.gameId, g.id), eq(aftermathReport.warbandId, id)));
		return {
			id,
			player: r?.player.name ?? '?',
			name: r?.warband.name ?? '?',
			units: (await roster(id)).units.filter((u) => u.status === 'active'),
			report: report ? { id: report.id, status: report.status, lines: report.lines } : null
		};
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
	/** The player's report (rolled by the server): approve it onto the roster, or send it back with a word. */
	report: async ({ params, request }) => {
		const { c, g } = await findGame(params.id);
		const data = await request.formData();
		const warbandId = String(data.get('warband'));
		const r = await reportFor(g.id, warbandId);
		if (!r) return fail(404, { message: 'No report' });
		if (data.get('op') === 'approve') {
			if (!(await approve(r.id))) return fail(400, { message: 'Only a submitted report can be approved.' });
		} else await saveLines(r.id, r.lines, 'declined', String(data.get('reply') ?? '').trim().slice(0, 500) || 'Please look again.');
		publish(c.id);
		return { updated: 'the report' };
	},
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
