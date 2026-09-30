import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { advanceStage, chooseVision, dealVisions, ensureSeats, issueInvite, listSeats, revokeInvite } from '$lib/server/muster';
import { auditAuth } from '$lib/server/audit';
import { publish } from '$lib/server/hub';
import { EXTENDED_MAX_PLAYERS } from '$lib/seating';
import { buildGraph } from '$lib/rules/zones';
import { VISIONS } from '$lib/rules/visions';
import type { Actions, PageServerLoad } from './$types';

async function need() {
	const c = await currentCampaign();
	if (!c) error(404, 'Found a campaign first');
	return c;
}

/** The Campaign Master's mustering console: seats, invite links, warbands, Visions, and the step to the next stage. */
export const load: PageServerLoad = async () => {
	const c = await need();
	return {
		stage: c.stage,
		expectedPlayers: c.expectedPlayers,
		seats: await listSeats(c),
		entryZones: [...buildGraph(c.houseZones).zones.values()].filter((z) => z.type === 'entry').map((z) => ({ id: z.id, name: z.name })),
		visions: VISIONS.map((v) => ({ id: v.id, name: v.name }))
	};
};

export const actions: Actions = {
	seats: async ({ request }) => {
		const c = await need();
		const n = Number((await request.formData()).get('count'));
		if (!Number.isInteger(n) || n < 2 || n > EXTENDED_MAX_PLAYERS) return fail(400, { message: `Between 2 and ${EXTENDED_MAX_PLAYERS} seats.` });
		const made = await ensureSeats(c, n);
		publish(c.id);
		return { message: made ? `${made} seat${made === 1 ? '' : 's'} added.` : 'Those seats exist already.' };
	},

	rename: async ({ request }) => {
		const c = await need();
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim().slice(0, 60);
		if (!name) return fail(400, { message: 'A seat needs a name.' });
		await db.update(player).set({ name }).where(and(eq(player.id, String(data.get('player'))), eq(player.campaignId, c.id)));
		publish(c.id);
		return { message: 'Seat renamed.' };
	},

	invite: async (event) => {
		const c = await need();
		const playerId = String((await event.request.formData()).get('player'));
		const r = await issueInvite(c, playerId, event.locals.user?.id ?? null);
		if (!r.ok) return fail(400, { message: r.message });
		auditAuth(event, 'invite.issued', { targetType: 'player', targetId: playerId });
		// The link is shown this once: only its hash is stored.
		return { invite: { player: playerId, url: `${event.url.origin}/join/${r.token}` } };
	},

	revoke: async (event) => {
		const c = await need();
		const id = String((await event.request.formData()).get('invite'));
		await revokeInvite(c, id);
		auditAuth(event, 'invite.revoked', { targetType: 'invite', targetId: id });
		return { message: 'Invite link revoked.' };
	},

	entry: async ({ request }) => {
		const c = await need();
		const data = await request.formData();
		const zone = String(data.get('entryZone') ?? '');
		const valid = [...buildGraph(c.houseZones).zones.values()].some((z) => z.type === 'entry' && z.id === zone);
		if (!valid) return fail(400, { message: 'Choose an Entry Zone.' });
		await db.update(warband).set({ entryZone: zone }).where(and(eq(warband.id, String(data.get('warband'))), eq(warband.campaignId, c.id)));
		publish(c.id);
		return { message: 'Entry Zone set.' };
	},

	deal: async () => {
		const c = await need();
		const n = await dealVisions(c);
		return { message: n ? `Two Vision cards dealt to ${n} warband${n === 1 ? '' : 's'}.` : 'Every warband has its cards already (or the deck ran out).' };
	},

	choose: async ({ request }) => {
		const c = await need();
		const data = await request.formData();
		const r = await chooseVision(c, String(data.get('warband')), String(data.get('card')));
		if (!r.ok) return fail(400, { message: r.message });
		return { message: 'Vision kept.' };
	},

	advance: async (event) => {
		const c = await need();
		const override = (await event.request.formData()).has('override');
		const r = await advanceStage(c, override);
		if (!r.ok) return fail(400, { message: r.message });
		auditAuth(event, 'campaign.stage', { detail: { stage: r.stage, override } });
		return { message: r.stage === 'mustering' ? 'Mustering is open: send the invite links.' : r.stage === 'underway' ? 'The campaign is under way.' : 'Stage changed.' };
	}
};
