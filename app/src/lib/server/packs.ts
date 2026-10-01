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
import { rulesFaction, rulesItem, rulesKeyword, rulesPatron, rulesUnit } from './db/schema';
import { announceReload } from './hub';
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
	kept: number;
	removed: number;
}

// Book factions, plus the packs that aren't one: mercenaries, the glossary, Patrons, and items any warband may get.
const known = {
	factions: [
		...FACTIONS.map((f) => ({ id: f.id, name: f.name })),
		...['mercenaries', 'glossary', 'patrons', 'glory-items', 'exploration'].map((id) => ({ id, name: id }))
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

async function writeRows(tx: Tx, table: typeof rulesUnit | typeof rulesItem, rows: (UnitRow | ItemRow)[], faction: string, variant: string | null) {
	const t = table as typeof rulesUnit;
	let kept = 0;
	for (const row of rows) {
		const [old] = await tx.select().from(t).where(eq(t.id, row.id));
		if (old && old.origin !== 'book') {
			// The CM's edit stands; the book copy it reverts to is now the pack's.
			if (old.origin === 'edited') await tx.update(t).set({ bookCopy: row as unknown as Record<string, unknown> }).where(eq(t.id, row.id));
			kept++;
			continue;
		}
		const values = { ...row, verified: true, origin: 'book', bookCopy: null } as typeof rulesUnit.$inferInsert;
		if (old) await tx.update(t).set(values).where(eq(t.id, row.id));
		else await tx.insert(t).values(values);
	}
	// Book rows of this faction or variant that the pack no longer has.
	const scope = and(eq(t.faction, faction), variant ? eq(t.variant, variant) : isNull(t.variant), eq(t.origin, 'book'));
	const ids = rows.map((r) => r.id);
	const gone = await tx.delete(t).where(ids.length ? and(scope, notInArray(t.id, ids)) : scope).returning({ id: t.id });
	return { kept, removed: gone.length };
}

/** Load packs as the book (see the module note). */
export async function loadPacks(packs: FactionPack[]): Promise<PackResult[]> {
	const out: PackResult[] = [];
	await db.transaction(async (tx) => {
		for (const p of packs) {
			const label = p.variant ? `${p.factionId} / ${p.variant}` : p.factionId;
			for (const k of p.keywords) {
				const [old] = await tx.select().from(rulesKeyword).where(eq(rulesKeyword.name, k.name));
				if (old && old.origin !== 'book') continue;
				if (old) await tx.update(rulesKeyword).set({ ...k, verified: true }).where(eq(rulesKeyword.name, k.name));
				else await tx.insert(rulesKeyword).values({ ...k, verified: true, origin: 'book' });
			}
			// Patrons: the pack's own replace the book's; the CM's edited or own Patrons stay.
			if (p.patrons?.length) {
				const ids = p.patrons.map((x) => x.id);
				await tx.delete(rulesPatron).where(and(eq(rulesPatron.origin, 'book'), notInArray(rulesPatron.id, ids)));
				for (const x of p.patrons) {
					const [old] = await tx.select({ origin: rulesPatron.origin }).from(rulesPatron).where(eq(rulesPatron.id, x.id));
					if (old && old.origin !== 'book') continue;
					const row = { ...x, verified: true, origin: 'book' as const };
					if (old) await tx.update(rulesPatron).set(row).where(eq(rulesPatron.id, x.id));
					else await tx.insert(rulesPatron).values(row);
				}
			}
			if (p.factionId === 'glossary' || p.factionId === 'patrons') {
				out.push({ pack: label, units: 0, items: 0, keywords: p.keywords.length, patrons: p.patrons?.length ?? 0, kept: 0, removed: 0 });
				continue;
			}
			const r = p.rules;
			const [old] = await tx.select().from(rulesFaction).where(eq(rulesFaction.id, r.id));
			if (!old) await tx.insert(rulesFaction).values({ id: r.id, faction: r.faction, variant: r.variant, text: r.text, overrides: r.overrides, verified: true, origin: 'book' });
			else if (old.origin === 'book') await tx.update(rulesFaction).set({ text: r.text, overrides: r.overrides, verified: true }).where(eq(rulesFaction.id, r.id));
			const u = await writeRows(tx, rulesUnit, p.units, p.factionId, p.variant);
			const i = await writeRows(tx, rulesItem, p.items, p.factionId, p.variant);
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
		names = readdirSync(dir).filter((n) => n.endsWith('.yaml'));
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
	return loadPacks(packs);
}
