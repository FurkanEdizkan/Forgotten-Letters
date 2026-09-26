import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { currentCampaign, rosters } from '$lib/server/campaign';
import { visionById } from '$lib/rules/visions';
import type { Actions } from './$types';

export function load() {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	return {
		warbands: rosters(c.id).map(({ warband: w, player: p }) => ({
			id: w.id,
			name: w.name,
			player: p.name,
			seat: p.seat,
			visionCard: w.visionCard
		}))
	};
}

export const actions: Actions = {
	keep: async ({ request }) => {
		const c = currentCampaign();
		if (!c) return fail(404);
		const data = await request.formData();
		const id = String(data.get('warband'));
		const card = String(data.get('card'));
		if (!visionById(card)) return fail(400, { message: 'Unknown card' });
		db.update(warband)
			.set({ visionCard: card, visionProgress: 0 })
			.where(and(eq(warband.id, id), eq(warband.campaignId, c.id)))
			.run();
		return { kept: id };
	}
};
