import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, max } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, rulesUnit, user, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { parseWarbandForm } from '$lib/server/warbands';
import { artFor, artIndex } from '$lib/server/unit-art';
import { allFactionRules } from '$lib/server/rules-data';
import { readRules } from '$lib/warband-rules';
import { publish } from '$lib/server/hub';
import { FACTIONS } from '$lib/rules/factions';
import { buildGraph } from '$lib/rules/zones';
import type { Actions, PageServerLoad } from './$types';
import { seatOf } from '$lib/server/muster';
import { forgetUserSessions } from '$lib/server/auth';
import { suggestedEntry } from '$lib/seating';

/** The book's starting strongbox. */
const START_DUCATS = 700;

/** The warband this account already plays in the campaign, if any. */
async function ownWarband(campaignId: string, userId: string) {
	const [row] = await db
		.select({ id: warband.id })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(and(eq(warband.campaignId, campaignId), eq(player.userId, userId)));
	return row?.id ?? null;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/login?next=/warbands/new');
	const c = await currentCampaign();
	if (!c) error(404, 'The campaign has not been founded yet');
	// Anyone signed in builds lists; founding the campaign warband is for a player who has none (or the CM),
	// once mustering has opened.
	const canFound = locals.isAdmin || (c.stage !== 'setup' && !(await ownWarband(c.id, locals.user.id)));
	// A seat that is already this player's suggests its Entry Zone (the Campaign Master's seating plan).
	const mySeat = locals.isAdmin ? null : await seatOf(c, locals.user.id);
	const [art, leaders] = await Promise.all([
		artIndex(c.id),
		db.select({ faction: rulesUnit.faction, name: rulesUnit.name, keywords: rulesUnit.keywords }).from(rulesUnit).orderBy(asc(rulesUnit.cost))
	]);
	/** The card picture: the CM's art for the faction's leader, else for any of its units. */
	const cover = (faction: string) => {
		const units = leaders.filter((u) => u.faction === faction);
		const ordered = [...units.filter((u) => u.keywords.includes('LEADER')), ...units];
		for (const u of ordered) {
			const a = artFor(art, faction, u.name);
			if (a) return a;
		}
		return null;
	};
	const players = locals.isAdmin
		? await db.select({ id: user.id, username: user.username, displayName: user.displayName }).from(user).where(eq(user.role, 'player')).orderBy(asc(user.username))
		: [];
	const taken = new Set(
		(await db.select({ userId: player.userId }).from(warband).innerJoin(player, eq(player.id, warband.playerId)).where(eq(warband.campaignId, c.id))).map((r) => r.userId)
	);
	return {
		factions: FACTIONS.map((f) => ({ id: f.id, name: f.name, alignment: f.alignment, variants: f.variants, cover: cover(f.id) })),
		entryZones: [...buildGraph(c.houseZones).zones.values()].filter((z) => z.type === 'entry').map((z) => ({ id: z.id, name: z.name })),
		players: players.map((p) => ({ ...p, hasWarband: taken.has(p.id) })),
		startDucats: START_DUCATS,
		canFound,
		suggestedEntry: mySeat ? suggestedEntry(mySeat.seat, c.expectedPlayers, c.houseZones) : null,
		/** Players can't choose: their seat decides (the Campaign Master can move them in Admin → Muster). */
		entryLocked: !locals.isAdmin,
		/** Each faction's and variant's starting money, from its special rules (Papal States: 500 and 11 Glory). */
		startMoney: await (async () => {
			const rows = await allFactionRules();
			const out: Record<string, { ducats: number; glory: number }> = {};
			for (const f of FACTIONS) {
				const base = rows.find((r) => r.faction === f.id && !r.variant);
				for (const v of [null, ...f.variants]) {
					const vr = v ? rows.find((x) => x.faction === f.id && x.variant === v) : undefined;
					const r = readRules(base?.text ?? null, vr?.text ?? null, [base?.overrides, vr?.overrides]);
					out[`${f.id}::${v ?? ''}`] = { ducats: r.startDucats, glory: r.startGlory };
				}
			}
			return out;
		})()
	};
};

const amount = (v: FormDataEntryValue | null, d: number) => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(0, Math.min(100_000, n)) : d;
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login?next=/warbands/new');
		const c = await currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const data = await request.formData();

		// A list of your own: no seat, no entry zone; it can be used for the campaign later.
		if (data.get('where') !== 'campaign') {
			const [faction, variant] = String(data.get('pick') ?? '').split('::');
			const f = FACTIONS.find((x) => x.id === faction);
			const name = String(data.get('name') ?? '').trim().slice(0, 80);
			if (!f) return fail(400, { message: 'Choose a faction' });
			if (!name) return fail(400, { message: 'Name the warband' });
			const [w] = await db
				.insert(warband)
				.values({
					listOwnerId: locals.user.id,
					name,
					faction: f.id,
					variant: variant && f.variants.includes(variant) ? variant : null,
					treasuryDucats: amount(data.get('ducats'), START_DUCATS),
					treasuryGlory: amount(data.get('glory'), 0),
					unrestricted: data.get('unrestricted') === 'on'
				})
				.returning({ id: warband.id });
			redirect(303, `/warbands/${w.id}`);
		}

		// Players found their own warband; the CM may found one for any player, or a seat with no account.
		let owner: { id: string | null; name: string } = { id: locals.user.id, name: locals.user.displayName || locals.user.username };
		if (locals.isAdmin) {
			const pick = String(data.get('for') ?? '');
			const [u] = pick ? await db.select().from(user).where(eq(user.id, pick)) : [];
			owner = u ? { id: u.id, name: u.displayName || u.username } : { id: null, name: String(data.get('playerName') ?? '').trim() };
		}
		if (!locals.isAdmin && c.stage === 'setup') return fail(400, { message: 'The campaign is still being set up: warbands open at mustering.' });
		if (owner.id && (await ownWarband(c.id, owner.id)))
			return fail(400, { message: locals.isAdmin ? 'That player already has a warband in this campaign.' : 'You already have a warband.' });
		data.set('playerName', owner.name);
		// Players land at their seat's Entry Zone; only the Campaign Master places a warband elsewhere.
		if (!locals.isAdmin) {
			const seat = await seatOf(c, locals.user.id);
			const [{ top }] = await db.select({ top: max(player.seat) }).from(player).where(eq(player.campaignId, c.id));
			data.set('entryZone', suggestedEntry(seat?.seat ?? (top ?? 0) + 1, c.expectedPlayers, c.houseZones));
		}
		// The picker sends "faction::variant" from one set of radio cards.
		const [faction, variant] = String(data.get('pick') ?? '').split('::');
		data.set('faction', faction ?? '');
		data.set('variant', variant ?? '');

		const { values, errors } = parseWarbandForm(data, c.houseZones);
		if (Object.keys(errors).length) return fail(400, { message: Object.values(errors)[0] });

		const id = await db.transaction(async (tx) => {
			// Reuse the account's empty seat if the CM already made one.
			const [seat] = owner.id
				? await tx.select().from(player).where(and(eq(player.campaignId, c.id), eq(player.userId, owner.id)))
				: [];
			const [{ top }] = await tx.select({ top: max(player.seat) }).from(player).where(eq(player.campaignId, c.id));
			const p =
				seat ??
				(await tx.insert(player).values({ campaignId: c.id, name: values.playerName, seat: (top ?? 0) + 1, userId: owner.id }).returning())[0];
			const [w] = await tx
				.insert(warband)
				.values({
					campaignId: c.id,
					playerId: p.id,
					name: values.name,
					faction: values.faction,
					variant: values.variant,
					entryZone: values.entryZone,
					treasuryDucats: amount(data.get('ducats'), START_DUCATS),
					treasuryGlory: amount(data.get('glory'), 0),
					unrestricted: data.get('unrestricted') === 'on'
				})
				.returning({ id: warband.id });
			return w.id;
		});
		// The owner's cached session lists the warbands they play: refresh it now, not in a minute.
		if (owner.id) await forgetUserSessions(owner.id);
		publish(c.id);
		// While mustering, a player goes back to their checklist (the Vision comes next).
		redirect(303, c.stage === 'mustering' && !locals.isAdmin ? '/muster' : `/warbands/${id}`);
	}
};
