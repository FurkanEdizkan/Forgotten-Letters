import { error, fail } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { adjustment } from '$lib/server/db/schema';
import { currentCampaign, rosters, type AdjustmentPayload } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { buildGraph } from '$lib/rules/zones';
import { EFFECT_KINDS } from '$lib/effects';
import type { Effect } from '$lib/rules/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const rows = await rosters(c.id);
	const names = new Map(rows.map((r) => [r.warband.id, r.player.name]));
	return {
		warbands: rows.map((r) => ({ id: r.warband.id, player: r.player.name, seat: r.player.seat, name: r.warband.name })),
		zones: [...buildGraph(c.houseZones).zones.values()],
		adjustments: (await db
			.select()
			.from(adjustment)
			.where(eq(adjustment.campaignId, c.id))
			.orderBy(desc(adjustment.committedAt))
			)
			.map((a) => ({
				id: a.id,
				player: names.get(a.warbandId) ?? '?',
				effects: ((a.payload ?? { effects: [] }) as AdjustmentPayload).effects,
				note: a.note,
				at: a.committedAt
			}))
	};
};

const KINDS = new Set<string>(EFFECT_KINDS.map((k) => k.t));

export const actions: Actions = {
	add: async ({ request }) => {
		const c = await currentCampaign();
		if (!c) return fail(404);
		const data = await request.formData();
		const warbandId = String(data.get('warband') ?? '');
		if (!(await rosters(c.id)).some((r) => r.warband.id === warbandId)) return fail(400, { message: 'Choose a warband' });
		let effects: Effect[];
		try {
			effects = (JSON.parse(String(data.get('effects') ?? '[]')) as Effect[]).filter((e) => KINDS.has(e?.t));
		} catch {
			return fail(400, { message: 'Malformed effects' });
		}
		if (!effects.length) return fail(400, { message: 'Add at least one effect' });
		const payload: AdjustmentPayload = { effects };
		(await db.insert(adjustment)
			.values({
				campaignId: c.id,
				warbandId,
				kind: effects.map((e) => e.t).join(','),
				payload,
				note: String(data.get('note') ?? '').trim() || null
			})
			);
		publish(c.id);
		return { added: true };
	},
	delete: async ({ request }) => {
		const c = await currentCampaign();
		if (!c) return fail(404);
		const id = String((await request.formData()).get('id'));
		(await db.delete(adjustment)
			.where(and(eq(adjustment.id, id), eq(adjustment.campaignId, c.id)))
			);
		publish(c.id);
		return { deleted: true };
	}
};
