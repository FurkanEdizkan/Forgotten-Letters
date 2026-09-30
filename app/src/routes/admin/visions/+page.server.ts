import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { currentCampaign, rosters } from '$lib/server/campaign';
import { visionById } from '$lib/rules/visions';
import { dealVisions } from '$lib/server/muster';
import type { Actions } from './$types';

export async function load() {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	return {
		warbands: (await rosters(c.id)).map(({ warband: w, player: p }) => ({
			id: w.id,
			name: w.name,
			player: p.name,
			seat: p.seat,
			visionCard: w.visionCard,
			visionOffer: w.visionOffer ?? null
		}))
	};
}

export const actions: Actions = {
	deal: async () => {
		const c = await currentCampaign();
		if (!c) return fail(404);
		return { dealt: await dealVisions(c) };
	},

	keep: async ({ request }) => {
		const c = await currentCampaign();
		if (!c) return fail(404);
		const data = await request.formData();
		const id = String(data.get('warband'));
		const card = String(data.get('card'));
		if (!visionById(card)) return fail(400, { message: 'Unknown card' });
		(await db.update(warband)
			.set({ visionCard: card, visionProgress: 0 })
			.where(and(eq(warband.id, id), eq(warband.campaignId, c.id)))
			);
		return { kept: id };
	}
};
