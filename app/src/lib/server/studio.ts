/**
 * The Faction Studio's storage: authored factions and variants, and house-rule edits of book entries.
 * Everything written here is `verified`, so a re-import of the books keeps it; book rows that are edited keep
 * their book version in `bookCopy` for "Revert to book".
 */
import { announceReload } from './hub';
import { and, asc, eq, inArray, isNull, max } from 'drizzle-orm';
import { db } from './db';
import { customFaction, rulesFaction, rulesItem, rulesKeyword, rulesUnit } from './db/schema';
import { loadCustomFactions } from './factions';
import { FACTIONS } from '$lib/rules/factions';
import { SIGILS } from '$lib/sigils';
import { FACTION_METAL } from '$lib/seals';
import { slug, type FactionPack, type FactionRow, type ItemRow, type KeywordRow, type RulesRow, type UnitRow } from '$lib/faction-template';

export interface StudioEntry {
	/** Studio id: a faction id, or `${parent}--${slug(variant)}` for a variant. */
	id: string;
	name: string;
	alignment: 'faithful' | 'fallen';
	parent: string | null;
	custom: boolean;
}

const MERCS = { id: 'mercenaries', name: 'Mercenaries', alignment: 'faithful' as const, parent: null };

/** Every faction and variant, book and custom (FACTIONS already holds the registered custom ones). */
export async function studioEntries(): Promise<StudioEntry[]> {
	const custom = new Set((await db.select({ id: customFaction.id }).from(customFaction)).map((r) => r.id));
	const out: StudioEntry[] = [];
	for (const f of FACTIONS) {
		out.push({ id: f.id, name: f.name, alignment: f.alignment, parent: null, custom: custom.has(f.id) });
		for (const v of f.variants) {
			const id = `${f.id}--${slug(v)}`;
			out.push({ id, name: v, alignment: f.alignment, parent: f.id, custom: custom.has(id) });
		}
	}
	out.push({ ...MERCS, custom: false });
	return out;
}

/** The faction row, the faction id rows are filed under, and the variant name, for a Studio id. */
export async function resolve(id: string): Promise<{ faction: FactionRow; factionId: string; variant: string | null; custom: boolean } | null> {
	const [c] = await db.select().from(customFaction).where(eq(customFaction.id, id));
	if (c) {
		const faction: FactionRow = { id: c.id, name: c.name, alignment: c.alignment, parent: c.parent, description: c.description, colours: c.colours ?? null };
		return { faction, factionId: c.parent ?? c.id, variant: c.parent ? c.name : null, custom: true };
	}
	if (id === MERCS.id) return { faction: { ...MERCS, description: null, colours: null }, factionId: MERCS.id, variant: null, custom: false };
	const [parentId, v] = id.split('--');
	const f = FACTIONS.find((x) => x.id === parentId);
	if (!f) return null;
	const variant = v ? (f.variants.find((x) => slug(x) === v) ?? null) : null;
	if (v && !variant) return null;
	const s = SIGILS[f.id];
	const faction: FactionRow = {
		id,
		name: variant ?? f.name,
		alignment: f.alignment,
		parent: variant ? f.id : null,
		description: null,
		colours: !variant && s ? { metal: FACTION_METAL[f.id] ?? s.rim, low: s.low, high: s.high } : null
	};
	return { faction, factionId: f.id, variant, custom: false };
}

const variantIs = (col: typeof rulesUnit.variant | typeof rulesItem.variant, v: string | null) => (v ? eq(col, v) : isNull(col));

/** A faction or variant as a template pack (book, edited and custom rows alike). */
export async function packOf(id: string, edition: string): Promise<(FactionPack & { origins: Record<string, string> }) | null> {
	const r = await resolve(id);
	if (!r) return null;
	const { factionId, variant } = r;
	const units = await db
		.select()
		.from(rulesUnit)
		.where(and(eq(rulesUnit.edition, edition), eq(rulesUnit.faction, factionId), variantIs(rulesUnit.variant, variant)))
		.orderBy(asc(rulesUnit.sort), asc(rulesUnit.category), asc(rulesUnit.name));
	const items = await db
		.select()
		.from(rulesItem)
		.where(and(eq(rulesItem.edition, edition), eq(rulesItem.faction, factionId), variantIs(rulesItem.variant, variant)))
		.orderBy(asc(rulesItem.sort), asc(rulesItem.category), asc(rulesItem.name));
	const [rules] = await db.select().from(rulesFaction).where(and(eq(rulesFaction.edition, edition), eq(rulesFaction.id, `${factionId}:${variant ?? ''}`)));
	// Keywords are global; a faction carries the authored ones its entries use.
	const used = [...new Set([...units, ...items].flatMap((x) => x.keywords))];
	const keywords = used.length
		? (await db.select().from(rulesKeyword).where(and(eq(rulesKeyword.edition, edition), inArray(rulesKeyword.name, used)))).filter((k) => k.origin !== 'book')
		: [];
	const origins: Record<string, string> = {};
	for (const x of [...units, ...items]) origins[x.id] = x.origin;
	return {
		faction: r.faction,
		factionId,
		variant,
		rules: { id: `${factionId}:${variant ?? ''}`, faction: factionId, variant, text: rules?.text ?? '', overrides: rules?.overrides ?? null },
		units: units.map((u) => ({
			id: u.id, faction: u.faction, variant: u.variant, name: u.name, category: u.category, availabilityMin: u.availabilityMin,
			availabilityMax: u.availabilityMax, cost: u.cost, currency: u.currency, stats: u.stats, keywords: u.keywords, abilities: u.abilities,
			battlekitNote: u.battlekitNote, powers: u.powers, description: u.description, kit: u.kit ?? null
		})),
		items: items.map((i) => ({
			id: i.id, faction: i.faction, variant: i.variant, category: i.category, name: i.name, unique: i.unique, cost: i.cost, currency: i.currency,
			limit: i.limit, restrictions: i.restrictions, type: i.type, range: i.range, keywords: i.keywords, text: i.text, description: i.description,
			stipulations: i.stipulations ?? null
		})),
		keywords: keywords.map((k) => ({ name: k.name, kind: k.kind, text: k.text })),
		origins
	};
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Save a row: new ones are `custom`; a book row becomes `edited` and keeps its book version once. */
async function upsert(tx: Tx, table: typeof rulesUnit | typeof rulesItem, row: UnitRow | ItemRow, edition: string) {
	const t = table as typeof rulesUnit;
	const at = and(eq(t.edition, edition), eq(t.id, row.id));
	const [old] = await tx.select().from(t).where(at);
	if (old && Object.entries(row).every(([k, v]) => JSON.stringify(v) === JSON.stringify((old as Record<string, unknown>)[k]))) return 'unchanged';
	const origin = !old ? 'custom' : old.origin === 'book' ? 'edited' : old.origin;
	const bookCopy = old?.origin === 'book' ? old : (old?.bookCopy ?? null);
	const values = { ...row, edition, verified: true, origin, bookCopy } as typeof rulesUnit.$inferInsert;
	if (old) await tx.update(t).set(values).where(at);
	else {
		// A new entry goes last in its edition's order.
		const [{ last }] = await tx.select({ last: max(t.sort) }).from(t).where(eq(t.edition, edition));
		await tx.insert(t).values({ ...values, sort: (last ?? 0) + 1 });
	}
	return old ? 'changed' : 'created';
}

async function upsertKeyword(tx: Tx, k: KeywordRow, edition: string) {
	const at = and(eq(rulesKeyword.edition, edition), eq(rulesKeyword.name, k.name));
	const [old] = await tx.select().from(rulesKeyword).where(at);
	const origin = !old ? 'custom' : old.origin === 'book' ? 'edited' : old.origin;
	if (old) await tx.update(rulesKeyword).set({ ...k, verified: true, origin }).where(at);
	else await tx.insert(rulesKeyword).values({ ...k, edition, verified: true, origin });
}

async function upsertRules(tx: Tx, r: RulesRow, edition: string) {
	const at = and(eq(rulesFaction.edition, edition), eq(rulesFaction.id, r.id));
	const [old] = await tx.select().from(rulesFaction).where(at);
	const origin = !old ? 'custom' : old.origin === 'book' ? 'edited' : old.origin;
	// An authored file without rule text keeps the book's.
	const text = r.text || old?.text || '';
	if (old) await tx.update(rulesFaction).set({ text, overrides: r.overrides, verified: true, origin }).where(at);
	else await tx.insert(rulesFaction).values({ edition, id: r.id, faction: r.faction, variant: r.variant, text, overrides: r.overrides, verified: true, origin });
}

/** A faction or variant in the shared list (the books', or an already registered custom one). */
const listed = (id: string) => id === MERCS.id || FACTIONS.some((f) => f.id === id.split('--')[0] && (!id.includes('--') || f.variants.some((v) => `${f.id}--${slug(v)}` === id)));

/** What applying a pack would do, entry by entry. */
export async function previewPack(p: FactionPack, edition: string) {
	const unitIds = new Set(
		(await db.select({ id: rulesUnit.id }).from(rulesUnit).where(and(eq(rulesUnit.edition, edition), inArray(rulesUnit.id, p.units.map((u) => u.id).concat(''))))).map((r) => r.id)
	);
	const itemIds = new Set(
		(await db.select({ id: rulesItem.id }).from(rulesItem).where(and(eq(rulesItem.edition, edition), inArray(rulesItem.id, p.items.map((i) => i.id).concat(''))))).map((r) => r.id)
	);
	const [known] = await db.select().from(customFaction).where(eq(customFaction.id, p.faction.id));
	return {
		faction: known ? 'changed' : listed(p.faction.id) ? 'book' : 'created',
		units: p.units.map((u) => ({ name: u.name, category: u.category, cost: u.cost, currency: u.currency, action: unitIds.has(u.id) ? 'changed' : 'created' })),
		items: p.items.map((i) => ({ name: i.name, category: i.category, cost: i.cost, currency: i.currency, action: itemIds.has(i.id) ? 'changed' : 'created' })),
		keywords: p.keywords.map((k) => k.name)
	};
}

/** Write a pack: the faction (unless it is a book one), its rules, keywords, units and armoury. */
export async function applyPack(p: FactionPack, edition: string) {
	const n = { created: 0, changed: 0, unchanged: 0 };
	await db.transaction(async (tx) => {
		const [known] = await tx.select({ id: customFaction.id }).from(customFaction).where(eq(customFaction.id, p.faction.id));
		if (known || !listed(p.faction.id)) {
			const { id, ...rest } = p.faction;
			await tx.insert(customFaction).values({ id, ...rest }).onConflictDoUpdate({ target: customFaction.id, set: rest });
		}
		await upsertRules(tx, p.rules, edition);
		for (const k of p.keywords) await upsertKeyword(tx, k, edition);
		for (const u of p.units) n[await upsert(tx, rulesUnit, u, edition)]++;
		for (const i of p.items) n[await upsert(tx, rulesItem, i, edition)]++;
	});
	await loadCustomFactions();
	announceReload('factions');
	return n;
}

export async function saveFaction(f: FactionRow) {
	const { id, ...rest } = f;
	await db.insert(customFaction).values({ id, ...rest }).onConflictDoUpdate({ target: customFaction.id, set: rest });
	await loadCustomFactions();
	announceReload('factions');
}
export const saveUnit = (u: UnitRow, edition: string) => db.transaction((tx) => upsert(tx, rulesUnit, u, edition));
export const saveItem = (i: ItemRow, edition: string) => db.transaction((tx) => upsert(tx, rulesItem, i, edition));
export const saveRules = (r: RulesRow, edition: string) => db.transaction((tx) => upsertRules(tx, r, edition));
export const saveKeyword = (k: KeywordRow, edition: string) => db.transaction((tx) => upsertKeyword(tx, k, edition));

/** Put an edited book row back as the book printed it. */
export async function revert(kind: 'unit' | 'item', id: string, edition: string) {
	const t = (kind === 'unit' ? rulesUnit : rulesItem) as typeof rulesUnit;
	const at = and(eq(t.edition, edition), eq(t.id, id));
	const [row] = await db.select().from(t).where(at);
	if (!row?.bookCopy) return false;
	await db.update(t).set({ ...(row.bookCopy as typeof rulesUnit.$inferInsert), edition, id, origin: 'book', bookCopy: null }).where(at);
	return true;
}

/** Remove an authored row (book rows are reverted, never deleted). */
export async function removeRow(kind: 'unit' | 'item', id: string, edition: string) {
	const t = (kind === 'unit' ? rulesUnit : rulesItem) as typeof rulesUnit;
	await db.delete(t).where(and(eq(t.edition, edition), eq(t.id, id), eq(t.origin, 'custom')));
}

/** Delete an authored faction or variant with everything filed under it. */
export async function deleteFaction(id: string) {
	const r = await resolve(id);
	if (!r?.custom) return false;
	await db.transaction(async (tx) => {
		for (const t of [rulesUnit, rulesItem] as (typeof rulesUnit)[])
			await tx.delete(t).where(and(eq(t.faction, r.factionId), variantIs(t.variant, r.variant), eq(t.origin, 'custom')));
		await tx.delete(rulesFaction).where(eq(rulesFaction.id, `${r.factionId}:${r.variant ?? ''}`));
		// A new faction takes its variants with it.
		if (!r.faction.parent) {
			const children = await tx.select().from(customFaction).where(eq(customFaction.parent, id));
			for (const c of children) await tx.delete(rulesFaction).where(eq(rulesFaction.id, `${id}:${c.name}`));
			await tx.delete(rulesUnit).where(eq(rulesUnit.faction, id));
			await tx.delete(rulesItem).where(eq(rulesItem.faction, id));
			await tx.delete(customFaction).where(eq(customFaction.parent, id));
		}
		await tx.delete(customFaction).where(eq(customFaction.id, id));
	});
	await loadCustomFactions();
	announceReload('factions');
	return true;
}

/** Put the units (or the armoury) in this order, as dragged in the editor: their `sort`. */
export async function setOrder(kind: 'unit' | 'item', ids: string[], edition: string) {
	const t = (kind === 'unit' ? rulesUnit : rulesItem) as typeof rulesUnit;
	await db.transaction(async (tx) => {
		for (const [n, id] of ids.entries()) await tx.update(t).set({ sort: n }).where(and(eq(t.edition, edition), eq(t.id, id)));
	});
}

/** Remove a keyword you wrote, where nothing in the edition uses it (book keywords are edited, never deleted). */
export async function removeKeyword(name: string, edition: string) {
	await db.delete(rulesKeyword).where(and(eq(rulesKeyword.edition, edition), eq(rulesKeyword.name, name), eq(rulesKeyword.origin, 'custom')));
}
