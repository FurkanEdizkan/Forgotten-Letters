/**
 * Editions of the rules side by side (1.0.2, a later one, a house edition). Every rules row belongs to one; a
 * warband is checked against its own edition. A new edition starts as a copy of another; entries are copied from
 * one edition to another singly, in a selection or all together; warbands move between editions the same way.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { edition, rulesFaction, rulesItem, rulesKeyword, rulesPatron, rulesTable, rulesUnit, rulesVersion, warband } from './db/schema';

/** The rules tables an edition holds, by the kind the editor and the version snapshots call them. */
export const TABLES = { units: rulesUnit, items: rulesItem, factions: rulesFaction, keywords: rulesKeyword, patrons: rulesPatron, tables: rulesTable } as const;
export type EntryKind = keyof typeof TABLES;
const keyOf = (kind: EntryKind) => (kind === 'keywords' ? 'name' : 'id');

export async function editions() {
	return db.select().from(edition).orderBy(asc(edition.createdAt));
}

/** The current edition's id: new warbands, the compendium and pack loads use it. */
export async function currentEditionId() {
	const [e] = await db.select({ id: edition.id }).from(edition).where(eq(edition.current, true));
	return e?.id ?? '1.0.2';
}

export async function editionById(id: string) {
	const [e] = await db.select().from(edition).where(eq(edition.id, id));
	return e ?? null;
}

/** A valid edition id from a request (an unknown one falls back to the current edition). */
export async function editionOr(id: string | null | undefined) {
	return id && (await editionById(id)) ? id : currentEditionId();
}

/** A new edition, a copy of another's every rules row (or empty). */
export async function createEdition(id: string, name: string, basedOn: string | null) {
	const clean = id.trim().slice(0, 40);
	if (!/^[\w.\- ]+$/.test(clean)) throw new Error('An edition id is letters, numbers, dots and dashes (e.g. 1.0.3).');
	if (await editionById(clean)) throw new Error(`There is already an edition ${clean}.`);
	await db.transaction(async (tx) => {
		await tx.insert(edition).values({ id: clean, name: name.trim().slice(0, 120) || clean, basedOn, status: 'draft' });
		if (basedOn)
			for (const t of Object.values(TABLES)) {
				const rows = await tx.select().from(t as typeof rulesUnit).where(eq((t as typeof rulesUnit).edition, basedOn));
				for (const r of rows) await tx.insert(t as typeof rulesUnit).values({ ...r, edition: clean });
			}
	});
	return clean;
}

/** Make an edition the current one (and live). */
export async function makeCurrent(id: string) {
	await db.transaction(async (tx) => {
		await tx.update(edition).set({ current: false }).where(eq(edition.current, true));
		await tx.update(edition).set({ current: true, status: 'live' }).where(eq(edition.id, id));
	});
}

export async function setStatus(id: string, status: 'draft' | 'live' | 'retired') {
	await db.update(edition).set({ status }).where(eq(edition.id, id));
}

/**
 * Copy entries (by id; all of the kind when `ids` is null) from one edition into another, replacing the target's
 * copies. Returns how many were copied.
 */
export async function copyEntries(kind: EntryKind, ids: string[] | null, from: string, to: string) {
	const t = TABLES[kind] as typeof rulesUnit;
	const key = keyOf(kind) as 'id';
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(t)
			.where(ids ? and(eq(t.edition, from), inArray(t[key], ids)) : eq(t.edition, from));
		for (const r of rows) {
			await tx.delete(t).where(and(eq(t.edition, to), eq(t[key], r[key])));
			await tx.insert(t).values({ ...r, edition: to });
		}
		return rows.length;
	});
}

/** Delete an edition and its rules: only one that is not current and that no warband uses. */
export async function deleteEdition(id: string) {
	const e = await editionById(id);
	if (!e || e.current) throw new Error('The current edition cannot be deleted.');
	const [used] = await db.select({ id: warband.id }).from(warband).where(eq(warband.edition, id)).limit(1);
	if (used) throw new Error('Warbands still use this edition: move them first.');
	await db.transaction(async (tx) => {
		for (const t of Object.values(TABLES)) await tx.delete(t as typeof rulesUnit).where(eq((t as typeof rulesUnit).edition, id));
		await tx.delete(rulesVersion).where(eq(rulesVersion.edition, id));
		await tx.delete(edition).where(eq(edition.id, id));
	});
}

/** Move warbands (by id; every warband on `from` when `ids` is null) to an edition. */
export async function moveWarbands(ids: string[] | null, to: string, from?: string) {
	const where = ids ? inArray(warband.id, ids) : from ? eq(warband.edition, from) : undefined;
	const moved = await db.update(warband).set({ edition: to, rulesVersion: null }).where(where).returning({ id: warband.id });
	return moved.length;
}

/**
 * The edition the Campaign Master is editing: `?edition=` (remembered in a cookie), else the remembered one, else
 * the current edition. Every Studio and Admin → Rules route reads it, so its forms need not carry it.
 */
export async function studioEdition(event: { url: URL; cookies: import('@sveltejs/kit').Cookies }) {
	const asked = event.url.searchParams.get('edition');
	if (asked && (await editionById(asked))) {
		event.cookies.set('studio_edition', asked, { path: '/admin', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 90 });
		return asked;
	}
	return editionOr(event.cookies.get('studio_edition'));
}
