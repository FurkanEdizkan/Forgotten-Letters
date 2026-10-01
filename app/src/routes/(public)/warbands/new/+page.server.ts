import { error, fail, redirect } from '@sveltejs/kit';
import { and, asc, eq, max } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, rulesUnit, user, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { parseWarbandForm } from '$lib/server/warbands';
import { artFor, artIndex } from '$lib/server/unit-art';
import { allFactionRules, allPatrons } from '$lib/server/rules-data';
import { findPatron, patronAllowed } from '$lib/patrons';
import { readRules } from '$lib/warband-rules';
import { publish } from '$lib/server/hub';
import { FACTIONS, subFactions } from '$lib/rules/factions';
import { buildGraph } from '$lib/rules/zones';
import type { Actions, PageServerLoad } from './$types';
import { seatOf } from '$lib/server/muster';
import { forgetUserSessions } from '$lib/server/auth';
import { suggestedEntry } from '$lib/seating';
import { importInto, readTcSource } from '$lib/server/tc-import';

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

interface PickRules {
	ducats: number;
	glory: number;
	leader: string | null;
	/** The one Patron it must serve, if the books name one. */
	patron: string | null;
	mustInclude: { name: string; n: number }[];
	excluded: string[];
	caps: { name: string; max: number }[];
	upgrades: { name: string; cost: number; currency: 'ducats' | 'glory'; max: number | null; for: string[] }[];
	/** The rules as printed, one entry per rule ("Name: text"). */
	faction: { name: string | null; text: string }[];
	variant: { name: string | null; text: string }[];
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
		// Carcass Front's own lists are picked under the faction whose variant they stand in for.
		factions: FACTIONS.filter((f) => !f.under).map((f) => ({
			id: f.id,
			name: f.name,
			alignment: f.alignment,
			variants: f.variants,
			cover: cover(f.id),
			subs: subFactions(f.id).map((x) => ({ id: x.id, name: x.name, book: x.book ?? null, variants: x.variants }))
		})),
		patrons: await allPatrons(),
		entryZones: [...buildGraph(c.houseZones).zones.values()].filter((z) => z.type === 'entry').map((z) => ({ id: z.id, name: z.name })),
		players: players.map((p) => ({ ...p, hasWarband: taken.has(p.id) })),
		startDucats: START_DUCATS,
		canFound,
		suggestedEntry: mySeat ? suggestedEntry(mySeat.seat, c.expectedPlayers, c.houseZones) : null,
		/** Players can't choose: their seat decides (the Campaign Master can move them in Admin → Muster). */
		entryLocked: !locals.isAdmin,
		/**
		 * What each faction and variant brings, shown when it is picked: its starting money (Papal States: 500 and 11
		 * Glory), what it must and cannot include, its caps and upgrades, and its special rules as printed.
		 */
		rulesFor: await (async () => {
			const rows = await allFactionRules();
			const out: Record<string, PickRules> = {};
			const lines = (t: string | null | undefined) =>
				(t ?? '')
					.split(/\n(?=\s*\*\s)|\n{2,}/)
					.map((x) => x.trim().replace(/^\*\s*/, ''))
					.filter(Boolean)
					.map((x) => {
						const m = /^([^:]{2,60}):\s*([\s\S]*)$/.exec(x);
						return m ? { name: m[1], text: m[2] } : { name: null, text: x };
					});
			for (const f of FACTIONS) {
				const base = rows.find((r) => r.faction === f.id && !r.variant);
				for (const v of [null, ...f.variants]) {
					const vr = v ? rows.find((x) => x.faction === f.id && x.variant === v) : undefined;
					const r = readRules(base?.text ?? null, vr?.text ?? null, [base?.overrides, vr?.overrides]);
					out[`${f.id}::${v ?? ''}`] = {
						ducats: r.startDucats,
						glory: r.startGlory,
						leader: r.leader,
						patron: r.patron,
						mustInclude: r.mustInclude,
						excluded: r.excluded,
						caps: r.caps,
						upgrades: r.upgrades.map((u) => ({ name: u.name, cost: u.cost, currency: u.currency, max: u.max, for: u.for })),
						faction: lines(base?.text),
						variant: v ? lines(vr?.text) : []
					};
				}
			}
			return out;
		})()
	};
};

/** A pick's rules: its faction's, with its variant's over them. */
async function rulesOf(faction: string, variant: string | null) {
	const rows = await allFactionRules();
	const base = rows.find((r) => r.faction === faction && !r.variant);
	const vr = variant ? rows.find((r) => r.faction === faction && r.variant === variant) : undefined;
	return readRules(base?.text ?? null, vr?.text ?? null, [base?.overrides, vr?.overrides]);
}

/** The strongbox a pick starts with: its variant's (or faction's) starting money. */
async function startOf(faction: string, variant: string | null) {
	const r = await rulesOf(faction, variant);
	return { ducats: r.startDucats, glory: r.startGlory };
}

/** The book's starting money; only the Campaign Master may start a warband with other sums. */
async function money(data: FormData, isAdmin: boolean, faction: string, variant: string | null) {
	const start = await startOf(faction, variant);
	return isAdmin ? { treasuryDucats: amount(data.get('ducats'), start.ducats), treasuryGlory: amount(data.get('glory'), start.glory) } : { treasuryDucats: start.ducats, treasuryGlory: start.glory };
}

const amount = (v: FormDataEntryValue | null, d: number) => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(0, Math.min(100_000, n)) : d;
};

export const actions: Actions = {
	// A list of your own, started from a Trench Companion warband: its faction and variant come with it.
	fromTc: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login?next=/warbands/new');
		const d = await request.formData();
		let imported;
		try {
			const file = d.get('file');
			imported = await readTcSource({
				link: String(d.get('link') ?? '').slice(0, 300),
				text: file instanceof File && file.size ? (await file.text()).slice(0, 400_000) : String(d.get('text') ?? '').slice(0, 400_000)
			});
		} catch (e) {
			return fail(400, { tcMessage: (e as Error).message });
		}
		if (!imported.faction) return fail(400, { tcMessage: `“${imported.name}” is of a faction this tracker doesn't know (${imported.sourceFaction ?? 'none given'}).` });
		const [w] = await db
			.insert(warband)
			.values({
				listOwnerId: locals.user.id,
				name: imported.name.slice(0, 80),
				faction: imported.faction,
				variant: imported.variant,
				patron: findPatron(await allPatrons(), imported.patron)?.name ?? imported.patron ?? null,
				treasuryDucats: 0,
				treasuryGlory: 0
			})
			.returning();
		await importInto(w, imported);
		redirect(303, `/warbands/${w.id}?imported=1`);
	},
	// Found a warband (a list of your own, or the campaign's), step by step.
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/login?next=/warbands/new');
		const c = await currentCampaign();
		if (!c) return fail(404, { message: 'No campaign' });
		const data = await request.formData();
		// The Patron it serves, if any: one this faction and variant may take.
		const patronName = String(data.get('patron') ?? '').trim();
		if (patronName) {
			const [pf, pv] = String(data.get('pick') ?? '').split('::');
			const pat = (await allPatrons()).find((p) => p.name === patronName);
			const fac = FACTIONS.find((x) => x.id === pf);
			if (!pat || !fac || !patronAllowed(pat, { faction: fac.id, variant: pv || null, alignment: fac.alignment }))
				return fail(400, { message: `${patronName} is not a Patron this warband may serve.` });
		}
		// Some warbands serve one Patron only (the Knights of Avarice, Mammon).
		{
			const [pf, pv] = String(data.get('pick') ?? '').split('::');
			const pr = await rulesOf(pf, pv || null);
			if (pr.requiresVariant && !pv) return fail(400, { message: 'Choose one of this faction\'s variants.' });
			const must = pr.patron;
			if (must && !patronName.toLowerCase().startsWith(must.toLowerCase())) return fail(400, { message: `This warband serves ${must}: choose it as its Patron.` });
		}

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
					patron: patronName || null,
					...(await money(data, !!locals.isAdmin, f.id, variant && f.variants.includes(variant) ? variant : null)),
					unrestricted: !!locals.isAdmin && data.get('unrestricted') === 'on'
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

		const start = await money(data, !!locals.isAdmin, values.faction, values.variant);
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
					...start,
					unrestricted: !!locals.isAdmin && data.get('unrestricted') === 'on'
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
