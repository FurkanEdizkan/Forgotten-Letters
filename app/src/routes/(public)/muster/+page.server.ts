import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { chooseVision, listSeats, seatOf } from '$lib/server/muster';
import { auditAuth } from '$lib/server/audit';
import { visionById } from '$lib/rules/visions';
import type { Actions, PageServerLoad } from './$types';

/** A player's own way into the campaign: their seat, their warband, their Vision, and who else is ready. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login?next=/muster');
	const c = await currentCampaign();
	if (!c) redirect(303, '/');
	const seat = await seatOf(c, locals.user.id);
	const [w] = seat ? await db.select().from(warband).where(and(eq(warband.playerId, seat.id), eq(warband.campaignId, c.id))) : [];
	const seats = await listSeats(c);
	const mine = seats.find((s) => s.playerId === seat?.id);
	return {
		stage: c.stage,
		campaign: c.name,
		seat: seat ? { number: seat.seat, name: seat.name, suggestedEntry: mine?.suggestedEntry ?? null } : null,
		warband: w ? { id: w.id, name: w.name, entryZone: w.entryZone } : null,
		vision: w?.visionCard ? visionById(w.visionCard) ?? null : null,
		offer: (w?.visionOffer ?? []).flatMap((id) => {
			const v = visionById(id);
			return v ? [{ id: v.id, name: v.name, levels: v.levels }] : [];
		}),
		steps: mine?.steps ?? null,
		roll: seats.map((s) => ({ name: s.warband?.name ?? s.name, ready: s.steps.ready, me: s.playerId === seat?.id }))
	};
};

export const actions: Actions = {
	vision: async (event) => {
		const { locals, request } = event;
		if (!locals.user) redirect(303, '/login?next=/muster');
		const c = await currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const seat = await seatOf(c, locals.user.id);
		const [w] = seat ? await db.select({ id: warband.id }).from(warband).where(and(eq(warband.playerId, seat.id), eq(warband.campaignId, c.id))) : [];
		if (!w) return fail(400, { message: 'Build your warband first.' });
		const r = await chooseVision(c, w.id, String((await request.formData()).get('card')));
		if (!r.ok) return fail(400, { message: r.message });
		auditAuth(event, 'vision.chosen', { targetType: 'warband', targetId: w.id });
		return { chosen: true };
	}
};
