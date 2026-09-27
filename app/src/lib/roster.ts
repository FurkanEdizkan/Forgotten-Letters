/** Warband roster rules shared by the admin builder, public views and imports. */

export type Currency = 'ducats' | 'glory';
export type ItemKind = 'ranged' | 'melee' | 'armour' | 'equipment';
export type Category = 'elite' | 'troop' | 'mercenary';

export interface Item {
	name: string;
	kind: ItemKind;
	cost: number;
	currency: Currency;
}

export interface RosterUnit {
	name: string;
	type: string;
	category: Category;
	leader: boolean;
	cost: number;
	currency: Currency;
	experience: number;
	equipment: Item[];
	upgrades: string[];
	skills: string[];
	injuries: string[];
	stats: { movement?: string; ranged?: string; melee?: string; armour?: string; base?: string };
	notes?: string | null;
	status: 'active' | 'dead' | 'retired';
}

/** Selling returns half the price, rounded up; a refund returns it in full. */
export const sellValue = (cost: number) => Math.ceil(cost / 2);

export function rosterTotals(units: RosterUnit[], stash: Item[] = []) {
	const t = { ducats: 0, glory: 0 };
	const add = (cost: number, currency: Currency) => (t[currency] += cost);
	for (const u of units) {
		if (u.status !== 'active') continue;
		add(u.cost, u.currency);
		for (const e of u.equipment) add(e.cost, e.currency);
	}
	for (const e of stash) add(e.cost, e.currency);
	return t;
}

export function rosterWarnings(units: RosterUnit[]): string[] {
	const active = units.filter((u) => u.status === 'active');
	const out: string[] = [];
	if (!active.length) return out;
	const leaders = active.filter((u) => u.leader).length;
	if (leaders === 0) out.push('No Leader: every warband needs one.');
	if (leaders > 1) out.push('More than one Leader.');
	return out;
}

// ---------------------------------------------------------------- Trench Companion import

interface TcObjectRef {
	object_id?: string;
	name?: string;
}

/** Turn an ID like "sk_hardened_veteran" into "Hardened Veteran". */
export function humaniseId(id: string) {
	return id
		.replace(/^[a-z]{2}_/, '')
		.replace(/_\d+(_\d+)?$/, '')
		.split(/[_-]+/)
		.filter(Boolean)
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(' ');
}

/** Skills and injuries are object refs; upgrades are purchases wrapping an upgrade. */
function refName(r: TcObjectRef | string | Record<string, any>): string {
	if (typeof r === 'string') return humaniseId(r);
	const any = r as Record<string, any>;
	const nested = any.upgrade ?? any.skill ?? any.injury ?? any.content;
	const id = any.object_id ?? any.purchase?.purchaseid ?? any.purchase?.custom_rel?.upgrade_id ?? nested?.id;
	return any.name || nested?.name || (id ? humaniseId(id) : 'Unknown');
}

const currencyOf = (costType: unknown): Currency => (costType === 1 ? 'glory' : 'ducats');

function kindOf(name: string, id = ''): ItemKind {
	const s = `${name} ${id}`.toLowerCase();
	if (/armou?r|shield|helmet|carapace/.test(s)) return 'armour';
	if (/rifle|pistol|gun|musket|bow|grenade|launcher|flamer|jezzail|shotgun|carbine|cannon|thrower/.test(s)) return 'ranged';
	if (/sword|axe|club|mace|knife|dagger|maul|hammer|spear|halberd|flail|blade|scythe|bayonet|claw/.test(s)) return 'melee';
	return 'equipment';
}

export interface TcImport {
	name: string;
	ducats: number;
	glory: number;
	units: RosterUnit[];
	stash: Item[];
}

/**
 * Map a Trench Companion warband (the `warband_data` JSON behind a share link) onto
 * our roster. Stat lines aren't in the export, so they are left for the user to fill.
 */
export function fromTrenchCompanion(raw: unknown): TcImport {
	const outer = raw as { warband_data?: string } & Record<string, unknown>;
	const w = (typeof outer?.warband_data === 'string' ? JSON.parse(outer.warband_data) : outer) as Record<string, any>;
	if (!w || !Array.isArray(w.models)) throw new Error('That is not a Trench Companion warband');

	const item = (e: any): Item => {
		const eq = e?.equipment ?? {};
		const name = eq.name ?? humaniseId(eq.id ?? e?.purchase?.purchaseid ?? 'item');
		return {
			name,
			kind: kindOf(name, eq.id),
			cost: Number(e?.purchase?.cost_value) || 0,
			currency: currencyOf(e?.purchase?.cost_type)
		};
	};

	const units: RosterUnit[] = w.models.map((entry: any) => {
		const m = entry?.model ?? {};
		const rel = entry?.purchase?.custom_rel ?? {};
		const type = m.name ?? humaniseId(m.model ?? 'model');
		const elite = Boolean(m.elite);
		return {
			name: m.custom_name ?? m.nickname ?? type,
			type,
			category: rel.mercenary ? 'mercenary' : elite ? 'elite' : 'troop',
			leader: Boolean(rel.captain),
			cost: Number(entry?.purchase?.cost_value) || 0,
			currency: currencyOf(entry?.purchase?.cost_type),
			experience: Number(m.experience) || 0,
			equipment: (m.equipment ?? []).map(item),
			upgrades: (m.list_upgrades ?? []).map(refName),
			skills: (m.list_skills ?? []).map(refName),
			injuries: (m.list_injury ?? []).map(refName),
			stats: {},
			notes: Array.isArray(m.notes) && m.notes.length ? m.notes.map(String).join('\n') : null,
			status: m.active && m.active !== 'active' ? 'dead' : 'active'
		};
	});

	return {
		name: String(w.name ?? 'Imported warband'),
		ducats: Number(w.ducat_bank) || 0,
		glory: Number(w.glory_bank) || 0,
		units,
		stash: (w.equipment ?? []).map(item)
	};
}

/** Accepts a share link (…/warband/detail/123), an API URL, or a bare numeric id. */
export function trenchCompanionId(input: string): string | null {
	const m = /(?:warband(?:\/detail)?\/|^)(\d{3,})\/?$/.exec(input.trim());
	return m ? m[1] : null;
}
