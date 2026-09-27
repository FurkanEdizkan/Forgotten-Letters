import { fail, redirect } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, unit, warband, warbandStash } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { replaceRoster, roster } from '$lib/server/roster';
import { publish } from '$lib/server/hub';
import { FACTIONS } from '$lib/rules/factions';
import { sealLook } from '$lib/seals';
import { rosterTotals, type RosterUnit } from '$lib/roster';
import type { Actions, PageServerLoad } from './$types';

/** "Your Warbands": your own lists and your campaign warband (the CM sees every campaign warband). */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login?next=/warbands');
	const c = await currentCampaign();
	const lists = await db.select().from(warband).where(and(eq(warband.listOwnerId, locals.user.id), isNull(warband.campaignId)));
	const campaign = c
		? await db
				.select()
				.from(warband)
				.where(locals.isAdmin ? eq(warband.campaignId, c.id) : and(eq(warband.campaignId, c.id), inArray(warband.id, locals.user.warbandIds.length ? locals.user.warbandIds : ['-'])))
		: [];
	const all = [...campaign, ...lists];
	const units = all.length ? await db.select().from(unit).where(inArray(unit.warbandId, all.map((w) => w.id))) : [];
	const stash = all.length ? await db.select().from(warbandStash).where(inArray(warbandStash.warbandId, all.map((w) => w.id))) : [];
	const players = c ? await db.select().from(player).where(eq(player.campaignId, c.id)) : [];
	return {
		isAdmin: locals.isAdmin,
		/** The signed-in player's own campaign warband, for "Use for the campaign". */
		mine: campaign.find((w) => locals.user!.warbandIds.includes(w.id))?.id ?? null,
		warbands: all.map((w) => {
			const active = units.filter((u) => u.warbandId === w.id && u.status === 'active');
			const t = rosterTotals(active as unknown as RosterUnit[], stash.filter((s) => s.warbandId === w.id));
			return {
				id: w.id,
				name: w.name,
				faction: w.faction,
				factionName: FACTIONS.find((f) => f.id === w.faction)?.name ?? w.faction,
				variant: w.variant,
				seal: sealLook(w.faction, w.seal),
				ducats: t.ducats,
				glory: t.glory,
				models: active.length,
				inCampaign: !!w.campaignId,
				player: players.find((p) => p.id === w.playerId)?.name ?? null,
				createdAt: w.createdAt.getTime()
			};
		})
	};
};

export const actions: Actions = {
	/** Copy a list's roster and strongbox into your campaign warband (same faction and variant only). */
	useForCampaign: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login?next=/warbands');
		const c = await currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const d = await request.formData();
		const [list] = await db.select().from(warband).where(eq(warband.id, String(d.get('list'))));
		if (!list || list.campaignId || (list.listOwnerId !== locals.user.id && !locals.isAdmin)) return fail(404, { message: 'No such list' });
		const targetId = String(d.get('target') || '') || locals.user.warbandIds[0];
		const [target] = targetId ? await db.select().from(warband).where(and(eq(warband.id, targetId), eq(warband.campaignId, c.id))) : [];
		if (!target) return fail(400, { message: 'Found your campaign warband first (New Warband → The Carcass Front campaign).' });
		if (!locals.isAdmin && !locals.user.warbandIds.includes(target.id)) return fail(403, { message: 'That is not your warband.' });
		if (target.faction !== list.faction || (target.variant ?? null) !== (list.variant ?? null))
			return fail(400, { message: `Your campaign warband is ${target.variant ?? FACTIONS.find((f) => f.id === target.faction)?.name}; this list is ${list.variant ?? FACTIONS.find((f) => f.id === list.faction)?.name}.` });
		const { units, stash } = await roster(list.id);
		await replaceRoster(c.id, target.id, {
			units: units.map(({ id: _i, warbandId: _w, campaignId: _c, sort: _s, createdAt: _t, photo: _p, profileId: _pr, ...u }) => u as unknown as RosterUnit),
			stash: stash.map((s) => ({ name: s.name, kind: s.kind, cost: s.cost, currency: s.currency })),
			ducats: list.treasuryDucats,
			glory: list.treasuryGlory
		});
		// Keep each model tied to its rules entry.
		const fresh = await db.select().from(unit).where(eq(unit.warbandId, target.id));
		for (const [i, u] of fresh.entries()) if (units[i]?.profileId) await db.update(unit).set({ profileId: units[i].profileId }).where(eq(unit.id, u.id));
		await db.update(warband).set({ fireteams: [], unrestricted: list.unrestricted }).where(eq(warband.id, target.id));
		publish(c.id);
		redirect(303, `/warbands/${target.id}`);
	}
};
