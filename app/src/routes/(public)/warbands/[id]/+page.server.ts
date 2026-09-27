import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, rulesItem, rulesUnit, unit, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { canEditWarband } from '$lib/server/auth';
import { addUnit, buyItem, itemOp, removeUnit, roster, saveUnit } from '$lib/server/roster';
import { allKeywords, itemsOf, unitsOf } from '$lib/server/rules-data';
import { artFor, artIndex } from '$lib/server/unit-art';
import { publish } from '$lib/server/hub';
import { FACTIONS } from '$lib/rules/factions';
import { keywordKey } from '$lib/keywords';
import { KIND_OF, profileFor, recruitment, builderWarnings } from '$lib/builder';
import type { Actions, PageServerLoad } from './$types';

async function find(id: string) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const [row] = await db
		.select({ warband, player })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(and(eq(warband.id, id), eq(warband.campaignId, c.id)));
	if (!row) error(404, 'No such warband');
	return { c, ...row };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { c, warband: w, player: p } = await find(params.id);
	const faction = FACTIONS.find((f) => f.id === w.faction);
	const [{ units, stash }, own, mercs, armoury, keywords, art] = await Promise.all([
		roster(w.id),
		unitsOf(w.faction),
		unitsOf('mercenaries'),
		itemsOf(w.faction),
		allKeywords(),
		artIndex(c.id)
	]);
	// The warband's own variant first, so its entries win over same-named base ones.
	const profiles = [...own.filter((u) => w.variant && u.variant === w.variant), ...own.filter((u) => !w.variant || u.variant !== w.variant), ...mercs];
	const models = units.map((u) => ({ ...u, profileId: u.profileId ?? profileFor(u, profiles)?.id ?? null }));
	return {
		warband: { id: w.id, name: w.name, faction: w.faction, factionName: faction?.name ?? w.faction, alignment: faction?.alignment ?? null, variant: w.variant, patron: w.patron, player: p.name, portrait: p.portrait, symbol: w.symbol, ducats: w.treasuryDucats, glory: w.treasuryGlory, notes: w.rosterNotes, unrestricted: w.unrestricted },
		models: models.map((u) => ({ ...u, art: artFor(art, w.faction, u.type) })),
		stash,
		profiles,
		armoury,
		recruit: recruitment(profiles, models).map((r) => ({ id: r.profile.id, fielded: r.fielded, left: w.unrestricted ? null : r.left })),
		warnings: w.unrestricted ? [] : builderWarnings(profiles, models),
		glossary: Object.fromEntries(keywords.map((k) => [keywordKey(k.name), k.text])),
		canEdit: canEditWarband(locals.user, w.id)
	};
};

/** Every change needs the warband's player (or the CM). */
async function editable(id: string, locals: App.Locals) {
	const found = await find(id);
	if (!canEditWarband(locals.user, found.warband.id)) error(403, 'Only this warband’s player can change it');
	return found;
}

const str = (d: FormData, k: string, max = 200) => String(d.get(k) ?? '').trim().slice(0, max);

async function model(warbandId: string, unitId: string) {
	const [u] = await db.select().from(unit).where(and(eq(unit.id, unitId), eq(unit.warbandId, warbandId)));
	if (!u) error(404, 'No such model');
	return u;
}

export const actions: Actions = {
	recruit: async ({ params, request, locals }) => {
		const { c, warband: w } = await editable(params.id, locals);
		const d = await request.formData();
		const [p] = await db.select().from(rulesUnit).where(eq(rulesUnit.id, str(d, 'profile')));
		if (!p || (p.faction !== w.faction && p.faction !== 'mercenaries')) return fail(400, { message: 'Choose a unit from your faction’s list.' });
		if (!w.unrestricted && p.availabilityMax != null) {
			const { units } = await roster(w.id);
			const fielded = recruitment([p], units).find((r) => r.profile.id === p.id)?.fielded ?? 0;
			if (fielded >= p.availabilityMax) return fail(400, { message: `${p.name} is limited to ${p.availabilityMax}.` });
		}
		const name = str(d, 'name', 80) || p.name;
		await addUnit(
			c.id,
			w.id,
			{
				name,
				type: p.name,
				category: p.category,
				leader: p.keywords.includes('LEADER'),
				cost: p.cost,
				currency: p.currency,
				experience: 0,
				equipment: [],
				upgrades: [],
				skills: [],
				injuries: [],
				stats: p.stats,
				notes: null,
				status: 'active'
			},
			d.get('pay') !== 'no'
		);
		// addUnit appends the model; tie the newest one of this type to its rules entry.
		const { units } = await roster(w.id);
		const fresh = [...units].reverse().find((u) => u.type === p.name && !u.profileId);
		if (fresh) await db.update(unit).set({ profileId: p.id }).where(eq(unit.id, fresh.id));
		publish(c.id);
		return { recruited: fresh?.id ?? null };
	},

	buy: async ({ params, request, locals }) => {
		const { c, warband: w } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const [item] = await db.select().from(rulesItem).where(eq(rulesItem.id, str(d, 'item')));
		if (!item || item.faction !== w.faction) return fail(400, { message: 'Choose battlekit from your armoury.' });
		if (!w.unrestricted && item.limit != null && u.equipment.filter((e) => e.name === item.name).length >= item.limit)
			return fail(400, { message: `${item.name} is limited to ${item.limit}.` });
		await buyItem(w.id, u.id, { name: item.name, kind: KIND_OF[item.category], cost: item.cost, currency: item.currency });
		publish(c.id);
		return {};
	},

	item: async ({ params, request, locals }) => {
		const { c, warband: w } = await editable(params.id, locals);
		const d = await request.formData();
		const op = str(d, 'op');
		if (!['sell', 'refund', 'delete', 'move'].includes(op)) return fail(400);
		await itemOp(w.id, { unitId: str(d, 'unit'), index: Number(d.get('index')) }, op as 'sell' | 'refund' | 'delete' | 'move', 'stash');
		publish(c.id);
		return {};
	},

	unit: async ({ params, request, locals }) => {
		const { c, warband: w } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const lines = (k: string) =>
			str(d, k, 4000)
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean)
				.slice(0, 30);
		await saveUnit(w.id, u.id, {
			name: str(d, 'name', 80) || u.name,
			experience: Math.max(0, Math.min(999, Number(d.get('experience')) || 0)),
			injuries: lines('injuries'),
			skills: lines('skills'),
			upgrades: lines('upgrades'),
			notes: str(d, 'notes', 4000) || null,
			status: (['active', 'dead', 'retired'] as const).find((s) => s === d.get('status')) ?? u.status
		});
		publish(c.id);
		return { saved: u.id };
	},

	restrictions: async ({ params, request, locals }) => {
		const { c, warband: w } = await editable(params.id, locals);
		const d = await request.formData();
		await db.update(warband).set({ unrestricted: d.get('unrestricted') === 'on' }).where(eq(warband.id, w.id));
		publish(c.id);
		return {};
	},

	dismiss: async ({ params, request, locals }) => {
		const { c, warband: w } = await editable(params.id, locals);
		const d = await request.formData();
		const u = await model(w.id, str(d, 'unit'));
		const how = str(d, 'how');
		await removeUnit(w.id, u.id, how === 'refund' ? 'refund' : how === 'sell' ? 'sell' : 'none');
		publish(c.id);
		return { dismissed: u.id };
	}
};
