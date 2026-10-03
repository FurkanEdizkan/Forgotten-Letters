/**
 * The Rules Editor's Patrons and Campaign Phase tables (with the progression settings), edition by edition: a new
 * one is the Campaign Master's own (`custom`), an edited book one becomes `edited` and keeps the book's version once
 * for "Revert to book". Callers check rows with the pack readers (`readPatrons`, `readTables`, `readProgression`).
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from './db';
import { rulesPatron, rulesTable, rulesUnit } from './db/schema';
import { allItemNames, allKeywords } from './rules-data';
import { stable } from '$lib/rules-versions';
import type { Patron } from '$lib/patrons';
import type { CampaignTable, Progression } from '$lib/progression';

const TABLES = { patron: rulesPatron, table: rulesTable } as const;
export type CampaignKind = keyof typeof TABLES;

type Row = Record<string, unknown>;

/** Save a row: unchanged stays as it is; a book row's first edit keeps the book's version. */
async function upsert(kind: CampaignKind, row: Row & { id: string }, edition: string) {
	const t = TABLES[kind] as typeof rulesPatron;
	const at = and(eq(t.edition, edition), eq(t.id, row.id));
	const [old] = await db.select().from(t).where(at);
	if (old && Object.entries(row).every(([k, v]) => stable(v ?? null) === stable((old as Row)[k] ?? null))) return 'unchanged';
	const origin = !old ? 'custom' : old.origin === 'book' ? 'edited' : old.origin;
	const bookCopy = old?.origin === 'book' ? (({ bookCopy: _b, ...r }) => r)(old) : (old?.bookCopy ?? null);
	const values = { ...row, edition, verified: true, origin, bookCopy } as typeof rulesPatron.$inferInsert;
	if (old) await db.update(t).set(values).where(at);
	else await db.insert(t).values(values);
	return old ? 'changed' : 'created';
}

export const savePatron = (p: Patron, edition: string) => upsert('patron', { ...p }, edition);

export const saveTable = (t: CampaignTable, edition: string) => upsert('table', { ...t }, edition);

/** The progression settings live on the table row `progression`. */
export const saveProgression = (p: Progression, edition: string) =>
	upsert('table', { id: 'progression', name: 'Progression', dice: 'D6', text: p.text, rows: [], source: null, settings: p }, edition);

/** Put an edited book row back as the book printed it. */
export async function revertCampaign(kind: CampaignKind, id: string, edition: string) {
	const t = TABLES[kind] as typeof rulesPatron;
	const at = and(eq(t.edition, edition), eq(t.id, id));
	const [row] = await db.select().from(t).where(at);
	if (!row?.bookCopy) return false;
	await db.update(t).set({ ...(row.bookCopy as typeof rulesPatron.$inferInsert), edition, id, origin: 'book', bookCopy: null }).where(at);
	return true;
}

/** Remove the Campaign Master's own row (book rows are reverted, never deleted). */
export async function removeCampaign(kind: CampaignKind, id: string, edition: string) {
	const t = TABLES[kind] as typeof rulesPatron;
	await db.delete(t).where(and(eq(t.edition, edition), eq(t.id, id), eq(t.origin, 'custom')));
}

/** An edition's Patrons and tables with where they come from, for the editor. */
export const patronRows = (edition: string) => db.select().from(rulesPatron).where(eq(rulesPatron.edition, edition));
export const tableRows = (edition: string) => db.select().from(rulesTable).where(eq(rulesTable.edition, edition));

/** The names the editor's pickers suggest (keywords, entries, kit, Skills), and the keyword glossary. */
export async function editorNames(edition: string) {
	const [keywords, units, items, patrons, tables] = await Promise.all([
		allKeywords(edition),
		db.selectDistinct({ name: rulesUnit.name }).from(rulesUnit).where(eq(rulesUnit.edition, edition)).orderBy(asc(rulesUnit.name)),
		allItemNames(edition),
		patronRows(edition),
		tableRows(edition)
	]);
	return {
		keywordNames: keywords.map((k) => k.name),
		glossary: Object.fromEntries(keywords.map((k) => [k.name, k.text])),
		unitNames: units.map((u) => u.name),
		itemNames: items,
		skillNames: [...new Set([...patrons.flatMap((p) => p.skills.map((s) => s.name)), ...tables.flatMap((t) => t.rows.map((r) => r.name))])].filter(Boolean).sort()
	};
}
