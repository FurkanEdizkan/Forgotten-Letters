import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { rulesUnit, unit, warband, warbandStash } from '$lib/server/db/schema';
import { addUnit, buyItem, itemOp, removeUnit, roster, saveUnit, setBank } from '$lib/server/roster';
import { allKeywords } from '$lib/server/rules-data';
import { artFor, artIndex } from '$lib/server/unit-art';
import { publish } from '$lib/server/hub';
import { builderInput, builderWarband } from '$lib/server/builder';
import { builderState, entryOf, modelKeywords } from '$lib/builder-state';
import { equipCheck, findItem, letters, recruitCheck, unitKit, warbandIssues, type ArmouryItem, type ModelState } from '$lib/warband-rules';
import { KIND_OF } from '$lib/builder';
import { keywordKey } from '$lib/keywords';
import { sealLook } from '$lib/seals';
import type { Item } from '$lib/roster';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { w, p, c, isList, canEdit } = await builderWarband(params.id, locals.user);
	const [input, keywords, art] = await Promise.all([builderInput(w), allKeywords(), c ? artIndex(c.id) : Promise.resolve(new Map<string, string>())]);
	const { units } = await roster(w.id);
	const { rules, state, entries } = builderState(input);
	return {
		warband: {
			id: w.id,
			name: w.name,
			faction: w.faction,
			factionName: input.faction.name,
			alignment: input.faction.alignment,
			variant: w.variant,
			patron: w.patron,
			player: p?.name ?? null,
			portrait: p?.portrait ?? null,
			symbol: w.symbol,
			seal: sealLook(w.faction, w.seal),
			ducats: w.treasuryDucats,
			glory: w.treasuryGlory,
			notes: w.rosterNotes,
			lore: w.lore,
			unrestricted: w.unrestricted,
			openExploration: w.openExploration,
			fireteams: w.fireteams,
			isList,
			inCampaign: !!w.campaignId
		},
		input,
		models: units.map((u) => ({
			id: u.id,
			name: u.name,
			type: u.type,
			category: u.category,
			cost: u.cost,
			currency: u.currency,
			experience: u.experience,
			equipment: u.equipment,
			upgrades: u.upgrades,
			skills: u.skills,
			injuries: u.injuries,
			stats: u.stats,
			notes: u.notes,
			photo: u.photo,
			profileId: u.profileId,
			status: u.status,
			art: artFor(art, w.faction, u.type)
		})),
		stash: (await roster(w.id)).stash,
		/** Each entry's default picture (Admin → Factions), for the add dialogs. */
		profileArt: Object.fromEntries(input.profiles.map((pr) => [pr.id, artFor(art, w.faction, pr.name)])),
		issues: warbandIssues(state, rules, entries),
		glossary: Object.fromEntries(keywords.map((k) => [keywordKey(k.name), k.text])),
		canEdit
	};
};

const str = (d: FormData, k: string, max = 200) => String(d.get(k) ?? '').trim().slice(0, max);
const lines = (d: FormData, k: string) =>
	str(d, k, 4000)
		.split('\n')
		.map((s) => s.trim())
		.filter(Boolean)
		.slice(0, 30);

/** Every change needs the warband's player, the list's owner, or the CM. Returns the rules view too. */
async function editable(id: string, locals: App.Locals) {
	const found = await builderWarband(id, locals.user);
	if (!found.canEdit) error(403, 'Only this warband’s player can change it');
	const input = await builderInput(found.w);
	return { ...found, input, ...builderState(input) };
}

async function model(warbandId: string, unitId: string) {
	const [u] = await db.select().from(unit).where(and(eq(unit.id, unitId), eq(unit.warbandId, warbandId)));
	if (!u) error(404, 'No such model');
	return u;
}

const done = (campaignId: string | null) => {
	if (campaignId) publish(campaignId);
	return {};
};

/** A roster item from an armoury entry (the four stored kinds). */
const asItem = (a: ArmouryItem, cost = a.cost): Item => ({ name: a.name, kind: KIND_OF[a.category], cost, currency: a.currency });

export const actions: Actions = {
	/** Recruit from the faction list: checks the variant's rules, pays, and hands out the entry's fixed kit free. */
	recruit: async ({ params, request, locals }) => {
		const { w, state, rules, input } = await editable(params.id, locals);
		const d = await request.formData();
		const profile = input.profiles.find((p) => p.id === str(d, 'profile'));
		if (!profile) return fail(400, { message: 'Choose a unit from your list.' });
		const check = recruitCheck(entryOf(profile), state, rules, input.faction);
		if (!check.ok) return fail(400, { message: check.reason });
		const [row] = await db.select().from(rulesUnit).where(eq(rulesUnit.id, profile.id));
		const kit = unitKit(profile.battlekitNote, profile.kit);
		const fixed: Item[] = kit.fixed.map((name) => {
			const a = findItem(input.armoury, name);
			return a ? asItem(a, 0) : { name, kind: 'equipment', cost: 0, currency: 'ducats' };
		});
		const keywords = modelKeywords({ id: '', type: profile.name, name: '', category: profile.category, status: 'active', profileId: profile.id, equipment: [], upgrades: [] }, profile, rules, []);
		await addUnit(
			w.campaignId,
			w.id,
			{
				name: str(d, 'name', 80),
				type: profile.name,
				category: profile.category,
				leader: keywords.includes('LEADER'),
				cost: profile.cost,
				currency: profile.currency,
				experience: 0,
				equipment: fixed,
				upgrades: [],
				skills: [],
				injuries: [],
				stats: row?.stats ?? {},
				notes: null,
				status: 'active'
			},
			d.get('pay') !== 'no'
		);
		const { units } = await roster(w.id);
		const fresh = [...units].reverse().find((u) => u.type === profile.name && !u.profileId);
		if (fresh) await db.update(unit).set({ profileId: profile.id }).where(eq(unit.id, fresh.id));
		done(w.campaignId);
		return { recruited: fresh?.id ?? null };
	},

	/** Buy battlekit for a model (or the arsenal) after checking the book's limits for that model. */
	buy: async ({ params, request, locals }) => {
		const { w, state, rules, input } = await editable(params.id, locals);
		const d = await request.formData();
		const item = input.armoury.find((a) => a.id === str(d, 'item'));
		if (!item) return fail(400, { message: 'Choose battlekit from your armoury.' });
		const target = str(d, 'unit');
		const held = [...state.models.flatMap((m) => m.equipment), ...state.stash];
		// "You must give the … to one model … free": the first one costs nothing.
		const free = rules.freeItems.some((f) => letters(f) === letters(item.name)) && !held.some((h) => letters(h.name) === letters(item.name));
		const cost = free ? 0 : item.cost;
		if (target !== 'stash') {
			const m = state.models.find((x) => x.id === target);
			if (!m) return fail(404, { message: 'No such model' });
			const check = equipCheck(m, { ...item, cost }, state);
			if (!check.ok) return fail(400, { message: check.reason });
		} else if ((item.currency === 'glory' ? w.treasuryGlory : w.treasuryDucats) < cost && !w.unrestricted) {
			return fail(400, { message: 'Not enough in the strongbox.' });
		}
		await buyItem(w.id, target, asItem(item, cost));
		return done(w.campaignId);
	},

	/** An item on a model or in the arsenal: sell, refund, delete, stash, give to another fighter, or buy a copy for one. */
	item: async ({ params, request, locals }) => {
		const { w, state, input } = await editable(params.id, locals);
		const d = await request.formData();
		const op = str(d, 'op');
		const stashId = str(d, 'stash');
		const ref = stashId ? { stashId } : { unitId: str(d, 'unit'), index: Number(d.get('index')) };
		const target = str(d, 'target') || 'stash';
		const heldItem = stashId ? (await roster(w.id)).stash.find((s) => s.id === stashId) : (await model(w.id, str(d, 'unit'))).equipment[Number(d.get('index'))];
		if (!heldItem) return fail(404, { message: 'No such item' });
		const armour = findItem(input.armoury, heldItem.name);
		if ((op === 'move' || op === 'copy') && target !== 'stash') {
			const m = state.models.find((x) => x.id === target);
			if (!m) return fail(404, { message: 'No such model' });
			// Moving costs nothing; the limit check must not count the item being moved.
			const probe: ModelState = m;
			const without = op === 'move' ? { ...state, ducats: 1e9, glory: 1e9, models: state.models.map((x) => ('unitId' in ref && x.id === ref.unitId ? { ...x, equipment: x.equipment.filter((_, i) => i !== ref.index) } : x)), stash: stashId ? [] : state.stash } : state;
			if (armour) {
				const check = equipCheck(probe, armour, without);
				if (!check.ok) return fail(400, { message: check.reason });
			}
		}
		if (op === 'copy') {
			await buyItem(w.id, target, { name: heldItem.name, kind: heldItem.kind, cost: heldItem.cost, currency: heldItem.currency });
			return done(w.campaignId);
		}
		if (!['sell', 'refund', 'delete', 'move'].includes(op)) return fail(400);
		await itemOp(w.id, ref, op as 'sell' | 'refund' | 'delete' | 'move', target);
		return done(w.campaignId);
	},

	unit: async ({ params, request, locals }) => {
		const { w } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const fields: Parameters<typeof saveUnit>[2] = {};
		if (d.has('name')) fields.name = str(d, 'name', 80);
		if (d.has('experience')) fields.experience = Math.max(0, Math.min(999, Number(d.get('experience')) || 0));
		if (d.has('injuries')) fields.injuries = lines(d, 'injuries');
		if (d.has('skills')) fields.skills = lines(d, 'skills');
		if (d.has('notes')) fields.notes = str(d, 'notes', 4000) || null;
		if (d.has('status')) fields.status = (['active', 'dead', 'retired'] as const).find((s) => s === d.get('status')) ?? u.status;
		await saveUnit(w.id, u.id, fields);
		return done(w.campaignId);
	},

	/** Promote a Troop to Elite (at most 6 ELITE models) or demote it again. */
	rank: async ({ params, request, locals }) => {
		const { w, state } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		if (u.category === 'mercenary') return fail(400, { message: 'Mercenaries keep their rank.' });
		const to = u.category === 'elite' ? 'troop' : 'elite';
		if (to === 'elite' && !w.unrestricted && state.models.filter((m) => m.status === 'active' && m.category === 'elite').length >= 6)
			return fail(400, { message: 'A warband can have at most 6 ELITE models.' });
		await db.update(unit).set({ category: to }).where(eq(unit.id, u.id));
		return done(w.campaignId);
	},

	/** Take or drop an upgrade: a variant's keyword upgrade (Swiss Guard) or an entry's armour swap. */
	upgrade: async ({ params, request, locals }) => {
		const { w, state, rules, input } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const name = str(d, 'name', 80);
		const on = d.get('on') === 'on';
		const m = state.models.find((x) => x.id === u.id)!;
		const keywordUp = rules.upgrades.find((x) => x.name === name);
		const swap = m.kit.swap && name === m.kit.swap.to ? m.kit.swap : null;
		if (!keywordUp && !swap) return fail(400, { message: 'No such upgrade.' });
		const has = u.upgrades.includes(name);
		if (on === has) return {};
		if (keywordUp && on && keywordUp.max != null && !w.unrestricted) {
			const taken = state.models.filter((x) => x.status === 'active' && x.upgrades.includes(name)).length;
			if (taken >= keywordUp.max) return fail(400, { message: `${name}: ${taken}/${keywordUp.max} taken.` });
		}
		let equipment = u.equipment;
		let extra = keywordUp?.cost ?? 0;
		if (swap) {
			const [from, to] = on ? [swap.from, swap.to] : [swap.to, swap.from];
			const a = findItem(input.armoury, to);
			equipment = u.equipment.map((e) => (letters(e.name) === letters(from) ? (a ? asItem(a, 0) : { ...e, name: to }) : e));
			extra = swap.extra;
		}
		if (on && extra > (w.treasuryDucats ?? 0) && !w.unrestricted) return fail(400, { message: `Costs ${extra} Ducats; ${w.treasuryDucats} in the strongbox.` });
		await db.transaction(async (tx) => {
			await tx
				.update(unit)
				.set({ upgrades: on ? [...u.upgrades, name] : u.upgrades.filter((x) => x !== name), equipment, cost: u.cost + (on ? extra : -extra) })
				.where(eq(unit.id, u.id));
			if (extra) await tx.update(warband).set({ treasuryDucats: w.treasuryDucats + (on ? -extra : extra) }).where(eq(warband.id, w.id));
		});
		return done(w.campaignId);
	},

	/** Recruit another of the same entry with the same battlekit, paying for both (checks limits). */
	copyFighter: async ({ params, request, locals }) => {
		const { w, state, rules, input } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const profile = input.profiles.find((p) => p.id === u.profileId);
		if (profile) {
			const check = recruitCheck(entryOf(profile), state, rules, input.faction);
			if (!check.ok) return fail(400, { message: check.reason });
		}
		const kitCost = u.equipment.reduce((s, e) => s + (e.currency === 'ducats' ? e.cost : 0), 0);
		if (!w.unrestricted && u.cost + kitCost > w.treasuryDucats && u.currency === 'ducats') return fail(400, { message: 'Not enough in the strongbox for a copy.' });
		for (const e of u.equipment) {
			const a = findItem(input.armoury, e.name);
			if (a?.limit != null && !w.unrestricted) {
				const held = [...state.models.flatMap((m) => m.equipment), ...state.stash].filter((h) => letters(h.name) === letters(e.name)).length;
				if (held + 1 > a.limit) return fail(400, { message: `${e.name}: limit ${a.limit} reached.` });
			}
		}
		await addUnit(w.campaignId, w.id, { ...u, name: u.name ? `${u.name} (copy)` : '', stats: u.stats, notes: u.notes, cost: u.cost }, true);
		if (kitCost) await setBank(w.id, (await db.select().from(warband).where(eq(warband.id, w.id)))[0].treasuryDucats - kitCost, w.treasuryGlory);
		const { units } = await roster(w.id);
		const fresh = units.at(-1);
		if (fresh) await db.update(unit).set({ profileId: u.profileId }).where(eq(unit.id, fresh.id));
		return done(w.campaignId);
	},

	dismiss: async ({ params, request, locals }) => {
		const { w } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const how = str(d, 'how');
		await removeUnit(w.id, u.id, how === 'refund' ? 'refund' : how === 'sell' ? 'sell' : 'none');
		return { ...done(w.campaignId), dismissed: u.id };
	},

	/** Warband settings: name, notes and lore, strongbox, Remove Restrictions, Open Exploration. */
	settings: async ({ params, request, locals }) => {
		const { w } = await editable(params.id, locals);
		const d = await request.formData();
		const set: Partial<typeof warband.$inferInsert> = {};
		if (d.has('name') && str(d, 'name', 80)) set.name = str(d, 'name', 80);
		if (d.has('notes')) set.rosterNotes = str(d, 'notes', 4000) || null;
		if (d.has('lore')) set.lore = str(d, 'lore', 8000) || null;
		if (d.has('restrictionsForm')) set.unrestricted = d.get('unrestricted') === 'on';
		if (d.has('explorationForm')) set.openExploration = d.get('openExploration') === 'on';
		if (d.has('ducats')) set.treasuryDucats = Math.round(Number(d.get('ducats')) || 0);
		if (d.has('glory')) set.treasuryGlory = Math.round(Number(d.get('glory')) || 0);
		if (Object.keys(set).length) await db.update(warband).set(set).where(eq(warband.id, w.id));
		return done(w.campaignId);
	},

	/** Fireteams: make one, add or remove a member, disband. */
	fireteam: async ({ params, request, locals }) => {
		const { w, rules } = await editable(params.id, locals);
		const d = await request.formData();
		const op = str(d, 'op');
		let teams = [...w.fireteams];
		if (op === 'new') {
			if (!w.unrestricted && rules.fireteams && teams.length >= rules.fireteams) return fail(400, { message: `At most ${rules.fireteams} Fireteams.` });
			teams.push({ name: `Fireteam ${teams.length + 1}`, members: [] });
		}
		const i = Number(d.get('team'));
		if (op === 'join' && teams[i]) {
			const member = str(d, 'unit');
			if (teams[i].members.length >= 2 && !w.unrestricted) return fail(400, { message: 'A Fireteam is two models.' });
			if (member && !teams[i].members.includes(member)) teams[i] = { ...teams[i], members: [...teams[i].members, member] };
		}
		if (op === 'leave' && teams[i]) teams[i] = { ...teams[i], members: teams[i].members.filter((x) => x !== str(d, 'unit')) };
		if (op === 'disband') teams = teams.filter((_, k) => k !== i).map((t, k) => ({ ...t, name: `Fireteam ${k + 1}` }));
		await db.update(warband).set({ fireteams: teams }).where(eq(warband.id, w.id));
		return done(w.campaignId);
	},

	/** A list only: delete it. */
	deleteList: async ({ params, locals }) => {
		const { w, isList } = await editable(params.id, locals);
		if (!isList) return fail(400, { message: 'A campaign warband is removed by the Campaign Master.' });
		await db.delete(warband).where(eq(warband.id, w.id));
		redirect(303, '/warbands');
	},

	/** Make a copy of this list (or of a campaign warband, as a new list). */
	duplicate: async ({ params, locals }) => {
		const { w } = await editable(params.id, locals);
		if (!locals.user) error(403);
		const { units, stash } = await roster(w.id);
		const [copy] = await db
			.insert(warband)
			.values({
				listOwnerId: w.listOwnerId ?? locals.user.id,
				name: `${w.name} (copy)`,
				faction: w.faction,
				variant: w.variant,
				patron: w.patron,
				treasuryDucats: w.treasuryDucats,
				treasuryGlory: w.treasuryGlory,
				unrestricted: w.unrestricted,
				openExploration: w.openExploration,
				rosterNotes: w.rosterNotes,
				lore: w.lore,
				seal: w.seal
			})
			.returning({ id: warband.id });
		const idMap = new Map<string, string>();
		for (const u of units) {
			const { id: oldId, createdAt: _c, id: _i, ...rest } = u;
			const [n] = await db.insert(unit).values({ ...rest, campaignId: null, warbandId: copy.id }).returning({ id: unit.id });
			idMap.set(oldId, n.id);
		}
		for (const s of stash) await db.insert(warbandStash).values({ warbandId: copy.id, name: s.name, kind: s.kind, cost: s.cost, currency: s.currency });
		await db
			.update(warband)
			.set({ fireteams: w.fireteams.map((t) => ({ ...t, members: t.members.map((m) => idMap.get(m) ?? m) })) })
			.where(eq(warband.id, copy.id));
		redirect(303, `/warbands/${copy.id}`);
	}
};
