/**
 * Book packs: the books' factions, variants, units, armoury and keywords as complete, checked Faction Studio files
 * (read from this group's own copies of the books; kept on the install, never committed). Loading one makes it the
 * book: its rows are written as `book` and verified, the faction's or variant's earlier book rows that the pack no
 * longer has are removed, and the Campaign Master's own work is kept: an entry edited in the Studio keeps the edit
 * (its "Revert to book" copy is refreshed to the pack's version), and custom entries are never touched.
 *
 * A pack whose faction id is `glossary` carries keywords only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { db } from './db';
import { rulesFaction, rulesItem, rulesKeyword, rulesPatron, rulesTable, rulesUnit } from './db/schema';
import { announceReload } from './hub';
import { currentEditionId } from './editions';
import { loadCustomFactions } from './factions';
import { FACTIONS } from '$lib/rules/factions';
import { parseTemplate, type FactionPack, type ItemRow, type UnitRow } from '$lib/faction-template';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export interface PackResult {
	pack: string;
	units: number;
	items: number;
	keywords: number;
	patrons?: number;
	tables?: number;
	kept: number;
	removed: number;
}

// Book factions, plus the packs that aren't one: mercenaries, the glossary, Patrons, and items any warband may get.
const known = {
	factions: [
		...FACTIONS.map((f) => ({ id: f.id, name: f.name })),
		...['mercenaries', 'glossary', 'patrons', 'glory-items', 'exploration', 'campaign'].map((id) => ({ id, name: id }))
	]
};

/** Read packs from YAML texts; any error refuses them all (nothing is half-loaded). */
export function readPacks(files: { name: string; text: string }[]) {
	const packs: FactionPack[] = [];
	const errors: string[] = [];
	for (const f of files) {
		const { pack, errors: e } = parseTemplate(f.text, known);
		for (const x of e) errors.push(`${f.name}: ${x.path}: ${x.message}`);
		if (pack) packs.push(pack);
	}
	return { packs: errors.length ? [] : packs, errors };
}

async function writeRows(tx: Tx, table: typeof rulesUnit | typeof rulesItem, rows: (UnitRow | ItemRow)[], faction: string, variant: string | null, edition: string) {
	const t = table as typeof rulesUnit;
	const at = (id: string) => and(eq(t.edition, edition), eq(t.id, id));
	let kept = 0;
	for (const [n, row] of rows.entries()) {
		const [old] = await tx.select().from(t).where(at(row.id));
		if (old && old.origin !== 'book') {
			// The CM's edit stands; the book copy it reverts to is now the pack's.
			if (old.origin === 'edited') await tx.update(t).set({ bookCopy: row as unknown as Record<string, unknown> }).where(at(row.id));
			kept++;
			continue;
		}
		// In the pack's order (the editor reorders them later).
		const values = { ...row, edition, sort: n, verified: true, origin: 'book', bookCopy: null } as typeof rulesUnit.$inferInsert;
		if (old) await tx.update(t).set(values).where(at(row.id));
		else await tx.insert(t).values(values);
	}
	// Book rows of this faction or variant that the pack no longer has.
	const scope = and(eq(t.edition, edition), eq(t.faction, faction), variant ? eq(t.variant, variant) : isNull(t.variant), eq(t.origin, 'book'));
	const ids = rows.map((r) => r.id);
	const gone = await tx.delete(t).where(ids.length ? and(scope, notInArray(t.id, ids)) : scope).returning({ id: t.id });
	return { kept, removed: gone.length };
}

/** Load packs as the book of an edition (see the module note). */
export async function loadPacks(packs: FactionPack[], edition: string): Promise<PackResult[]> {
	const out: PackResult[] = [];
	await db.transaction(async (tx) => {
		for (const p of packs) {
			const label = p.variant ? `${p.factionId} / ${p.variant}` : p.factionId;
			for (const k of p.keywords) {
				const at = and(eq(rulesKeyword.edition, edition), eq(rulesKeyword.name, k.name));
				const [old] = await tx.select().from(rulesKeyword).where(at);
				if (old && old.origin !== 'book') continue;
				if (old) await tx.update(rulesKeyword).set({ ...k, verified: true }).where(at);
				else await tx.insert(rulesKeyword).values({ ...k, edition, verified: true, origin: 'book' });
			}
			// Patrons: the pack's own replace the book's; the CM's edited or own Patrons stay.
			if (p.patrons?.length) {
				const ids = p.patrons.map((x) => x.id);
				await tx.delete(rulesPatron).where(and(eq(rulesPatron.edition, edition), eq(rulesPatron.origin, 'book'), notInArray(rulesPatron.id, ids)));
				for (const x of p.patrons) {
					const at = and(eq(rulesPatron.edition, edition), eq(rulesPatron.id, x.id));
					const [old] = await tx.select({ origin: rulesPatron.origin }).from(rulesPatron).where(at);
					if (old && old.origin !== 'book') continue;
					const row = { ...x, edition, verified: true, origin: 'book' as const };
					if (old) await tx.update(rulesPatron).set(row).where(at);
					else await tx.insert(rulesPatron).values(row);
				}
			}
			// The Campaign Phase's tables: the pack's replace the book's; the CM's own stay.
			if (p.tables?.length || p.progression) {
				const rows = [
					...(p.tables ?? []).map((t) => ({ ...t, settings: null })),
					...(p.progression ? [{ id: 'progression', name: 'Progression', dice: 'D6' as const, text: p.progression.text, rows: [], source: null, settings: p.progression }] : [])
				];
				await tx.delete(rulesTable).where(and(eq(rulesTable.edition, edition), eq(rulesTable.origin, 'book'), notInArray(rulesTable.id, rows.map((r) => r.id))));
				for (const r of rows) {
					const at = and(eq(rulesTable.edition, edition), eq(rulesTable.id, r.id));
					const [old] = await tx.select({ origin: rulesTable.origin }).from(rulesTable).where(at);
					if (old && old.origin !== 'book') continue;
					const row = { ...r, edition, verified: true, origin: 'book' as const };
					if (old) await tx.update(rulesTable).set(row).where(at);
					else await tx.insert(rulesTable).values(row);
				}
			}
			if (p.factionId === 'glossary' || p.factionId === 'patrons' || p.factionId === 'campaign') {
				out.push({ pack: label, units: 0, items: 0, keywords: p.keywords.length, patrons: p.patrons?.length ?? 0, tables: p.tables?.length ?? 0, kept: 0, removed: 0 });
				continue;
			}
			const r = p.rules;
			const at = and(eq(rulesFaction.edition, edition), eq(rulesFaction.id, r.id));
			const [old] = await tx.select().from(rulesFaction).where(at);
			if (!old) await tx.insert(rulesFaction).values({ edition, id: r.id, faction: r.faction, variant: r.variant, text: r.text, overrides: r.overrides, verified: true, origin: 'book' });
			else if (old.origin === 'book') await tx.update(rulesFaction).set({ text: r.text, overrides: r.overrides, verified: true }).where(at);
			const u = await writeRows(tx, rulesUnit, p.units, p.factionId, p.variant, edition);
			const i = await writeRows(tx, rulesItem, p.items, p.factionId, p.variant, edition);
			out.push({ pack: label, units: p.units.length, items: p.items.length, keywords: p.keywords.length, kept: u.kept + i.kept, removed: u.removed + i.removed });
		}
	});
	await loadCustomFactions();
	announceReload('factions');
	return out;
}

/** At start: packs in RULES_PACKS (default /data/packs), loaded once when the install has no rules yet. */
export async function loadPacksDirIfEmpty(dir = process.env.RULES_PACKS ?? '/data/packs') {
	let names: string[];
	try {
		// Not the template or packs-legal's example lists.
		names = readdirSync(dir).filter((n) => n.endsWith('.yaml') && !/^(legal-lists|TEMPLATE)/.test(n));
	} catch {
		return null;
	}
	const [any] = await db.select({ id: rulesUnit.id }).from(rulesUnit).limit(1);
	if (any || !names.length) return null;
	const { packs, errors } = readPacks(names.map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') })));
	if (errors.length) {
		console.error(`rules packs in ${dir} not loaded:\n  ${errors.join('\n  ')}`);
		return null;
	}
	return loadPacks(packs, await currentEditionId());
}
