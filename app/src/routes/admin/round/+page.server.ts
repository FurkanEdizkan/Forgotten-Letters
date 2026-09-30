import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { RoundError, openRound, openRoundOf, pickOpponent, pickOptions, roundBoard, rollForAggressor } from '$lib/server/rounds';
import { buildGraph } from '$lib/rules/zones';
import type { Actions, PageServerLoad } from './$types';

async function need() {
	const c = await currentCampaign();
	if (!c) error(404, 'Found a campaign first');
	return c;
}

/** The Campaign Master's round board: every roll, role and pairing, with a hand for any absent player. */
export const load: PageServerLoad = async () => {
	const c = await need();
	const board = await roundBoard(c);
	const open = await openRoundOf(c);
	const names = Object.fromEntries(
		(await db.select({ id: warband.id, name: warband.name }).from(warband).where(eq(warband.campaignId, c.id))).map((w) => [w.id, w.name])
	);
	const zones = Object.fromEntries([...buildGraph(c.houseZones).zones.values()].map((z) => [z.id, z.name]));
	return { stage: c.stage, board, names, zones, options: open ? await pickOptions(c, open.id) : null };
};

const run = async (f: () => Promise<unknown>, done: string) => {
	try {
		await f();
		return { message: done };
	} catch (e) {
		if (e instanceof RoundError) return fail(400, { message: e.message });
		throw e;
	}
};

export const actions: Actions = {
	open: async () => {
		const c = await need();
		return run(async () => {
			if (!(await openRound(c))) throw new RoundError('No round to open: fewer than two warbands can fight.');
		}, 'A new round is open: everyone rolls for Aggressor.');
	},
	roll: async ({ request }) => {
		const c = await need();
		const r = await openRoundOf(c);
		if (!r) return fail(400, { message: 'No round in progress' });
		const id = String((await request.formData()).get('warband'));
		return run(() => rollForAggressor(c, r.id, id), 'Rolled.');
	},
	pick: async ({ request }) => {
		const c = await need();
		const r = await openRoundOf(c);
		if (!r) return fail(400, { message: 'No round in progress' });
		const data = await request.formData();
		return run(
			() => pickOpponent(c, r.id, String(data.get('aggressor')), String(data.get('defender')), String(data.get('zone')), data.has('override')),
			'Battle planned.'
		);
	}
};
