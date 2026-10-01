import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { player, warband } from '$lib/server/db/schema';
import { currentCampaign } from '$lib/server/campaign';
import { publish } from '$lib/server/hub';
import { saveImage, removeImage } from '$lib/server/uploads';
import {
	addUnit,
	buyItem,
	itemOp,
	moveUnit,
	removeUnit,
	roster,
	saveUnit,
	setBank,
	type ItemRef
} from '$lib/server/roster';
import type { Item, RosterUnit } from '$lib/roster';
import { FACTIONS } from '$lib/rules/factions';
import { artFor, artIndex } from '$lib/server/unit-art';
import { importInto, readTcSource } from '$lib/server/tc-import';
import type { Actions, PageServerLoad } from './$types';

async function find(id: string) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const row = (await db
		.select({ warband, player })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(and(eq(warband.id, id), eq(warband.campaignId, c.id)))
		)[0];
	if (!row) error(404, 'No such warband');
	return { c, ...row };
}

const int = (v: unknown, min = 0, max = 100_000) => {
	const n = Math.round(Number(v));
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const str = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max);
const list = (v: unknown) =>
	(Array.isArray(v) ? v : [])
		.map((x) => str(x, 200))
		.filter(Boolean)
		.slice(0, 40);

function parseItem(raw: any): Item {
	return {
		name: str(raw?.name) || 'Item',
		kind: ['ranged', 'melee', 'armour', 'equipment'].includes(raw?.kind) ? raw.kind : 'equipment',
		cost: int(raw?.cost, 0, 10_000),
		currency: raw?.currency === 'glory' ? 'glory' : 'ducats'
	};
}

function parseUnit(raw: any): RosterUnit {
	return {
		name: str(raw?.name) || 'Unnamed',
		type: str(raw?.type),
		category: ['elite', 'troop', 'mercenary'].includes(raw?.category) ? raw.category : 'troop',
		leader: Boolean(raw?.leader),
		cost: int(raw?.cost, 0, 10_000),
		currency: raw?.currency === 'glory' ? 'glory' : 'ducats',
		experience: int(raw?.experience, 0, 999),
		equipment: (Array.isArray(raw?.equipment) ? raw.equipment : []).slice(0, 40).map(parseItem),
		upgrades: list(raw?.upgrades),
		skills: list(raw?.skills),
		injuries: list(raw?.injuries),
		stats: Object.fromEntries(
			['movement', 'ranged', 'melee', 'armour', 'base'].map((k) => [k, str(raw?.stats?.[k], 16)]).filter(([, v]) => v)
		),
		notes: str(raw?.notes, 2000) || null,
		status: ['active', 'dead', 'retired'].includes(raw?.status) ? raw.status : 'active'
	};
}

function json(data: FormData, key: string) {
	try {
		return JSON.parse(String(data.get(key) ?? 'null'));
	} catch {
		return null;
	}
}

export const load: PageServerLoad = async ({ params }) => {
	const { c, warband: w, player: p } = await find(params.id);
	const { units, stash } = await roster(w.id);
	const art = await artIndex(c.id);
	return {
		warband: { id: w.id, name: w.name, faction: w.faction, variant: w.variant, symbol: w.symbol, ducats: w.treasuryDucats, glory: w.treasuryGlory, notes: w.rosterNotes },
		player: { name: p.name, portrait: p.portrait },
		factionName: FACTIONS.find((f) => f.id === w.faction)?.name ?? w.faction,
		units: units.map((u) => ({ ...u, art: artFor(art, w.faction, u.type) })),
		stash
	};
};

export const actions: Actions = {
	bank: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		await setBank(w.id, int(data.get('ducats'), -100_000), int(data.get('glory'), -100_000));
		(await db.update(warband).set({ rosterNotes: str(data.get('notes'), 4000) || null }).where(eq(warband.id, w.id)));
		publish(c.id);
		return { saved: 'bank' };
	},

	addUnit: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		const u = parseUnit(json(data, 'unit'));
		await addUnit(c.id, w.id, u, data.has('pay'));
		publish(c.id);
		return { saved: 'unit' };
	},

	saveUnit: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		const unitId = str(data.get('unitId'), 64);
		const fields: Partial<RosterUnit> & { photo?: string | null } = parseUnit(json(data, 'unit'));
		try {
			const photo = await saveImage(c.id, data.get('photo'), 384);
			const old = (await roster(w.id)).units.find((u) => u.id === unitId)?.photo;
			if (photo || data.has('clearPhoto')) {
				await removeImage(old);
				fields.photo = photo;
			}
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
		await saveUnit(w.id, unitId, fields);
		publish(c.id);
		return { saved: 'unit' };
	},

	removeUnit: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		const mode = str(data.get('mode'), 10);
		await removeUnit(w.id, str(data.get('unitId'), 64), mode === 'sell' || mode === 'refund' ? mode : 'none');
		publish(c.id);
		return { saved: 'unit' };
	},

	moveUnit: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		await moveUnit(w.id, str(data.get('unitId'), 64), data.get('dir') === 'up' ? -1 : 1);
		publish(c.id);
		return {};
	},

	buyItem: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		try {
			await buyItem(w.id, str(data.get('target'), 64) || 'stash', parseItem(json(data, 'item')));
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
		publish(c.id);
		return { saved: 'item' };
	},

	itemOp: async ({ params, request }) => {
		const { c, warband: w } = await find(params.id);
		const data = await request.formData();
		const op = str(data.get('op'), 10) as 'move' | 'sell' | 'refund' | 'delete' | 'copy';
		if (!['move', 'sell', 'refund', 'delete', 'copy'].includes(op)) return fail(400, { message: 'Unknown action' });
		const stashId = str(data.get('stashId'), 64);
		const ref: ItemRef = stashId ? { stashId } : { unitId: str(data.get('unitId'), 64), index: int(data.get('index'), 0, 100) };
		try {
			await itemOp(w.id, ref, op, str(data.get('target'), 64) || 'stash');
		} catch (e) {
			return fail(400, { message: (e as Error).message });
		}
		publish(c.id);
		return { saved: 'item' };
	},

	// Trench Companion: the same import players use on their warband page, matched to the books.
	importTc: async ({ params, request }) => tcImport(params.id, request, 'link'),
	importFile: async ({ params, request }) => tcImport(params.id, request, 'file')
};

async function tcImport(id: string, request: Request, from: 'link' | 'file') {
	const { warband: w } = await find(id);
	const data = await request.formData();
	if (!data.has('confirm')) return fail(400, { importMessage: 'Tick the box to replace this roster.' });
	try {
		const file = data.get('file');
		const imported = await readTcSource(
			from === 'link' ? { link: str(data.get('link'), 300) } : { text: file instanceof File && file.size ? await file.text() : '' }
		);
		const r = await importInto(w, imported, { force: data.has('force') });
		if ('mismatch' in r) return fail(400, { importMessage: r.mismatch, mismatch: true });
		const unmatched = r.report.units.length + r.report.items.length + r.report.upgrades.length;
		return { imported: `${r.models} models from “${r.name}”${unmatched ? ` (${unmatched} not in the books: see the warband page)` : ''}` };
	} catch (e) {
		return fail(400, { importMessage: `Import failed: ${(e as Error).message}` });
	}
}
