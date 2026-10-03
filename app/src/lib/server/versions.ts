/**
 * Rules versions (see $lib/rules-versions): a snapshot of the effective rules after each load of the books and
 * each Studio edit, made only when the rules actually changed; and what changed since the version a warband pins.
 */
import { createHash } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { rulesFaction, rulesItem, rulesPatron, rulesTable, rulesUnit, rulesVersion, warband } from './db/schema';
import { stable, type Snapshot, type SnapRow } from '$lib/rules-versions';
import { editions } from './editions';

/** An edition's effective rules now, keyed by stable id. */
export async function snapshotNow(edition: string): Promise<Snapshot> {
	const [units, items, factions, patrons, tables] = await Promise.all([
		db.select().from(rulesUnit).where(eq(rulesUnit.edition, edition)),
		db.select().from(rulesItem).where(eq(rulesItem.edition, edition)),
		db.select().from(rulesFaction).where(eq(rulesFaction.edition, edition)),
		db.select().from(rulesPatron).where(eq(rulesPatron.edition, edition)),
		db.select().from(rulesTable).where(eq(rulesTable.edition, edition))
	]);
	const by = <T extends { id: string }>(rows: T[], row: (r: T) => SnapRow) => Object.fromEntries(rows.map((r) => [r.id, row(r)]));
	return {
		units: by(units, ({ id: _i, edition: _e, origin: _o, verified: _v, bookCopy: _b, sort: _s, ...r }) => r as SnapRow),
		items: by(items, ({ id: _i, edition: _e, origin: _o, verified: _v, bookCopy: _b, sort: _s, ...r }) => r as SnapRow),
		factions: by(factions, ({ id: _i, edition: _e, origin: _o, verified: _v, ...r }) => ({ ...r, name: r.variant ?? r.faction }) as SnapRow),
		patrons: by(patrons, ({ id: _i, edition: _e, origin: _o, verified: _v, bookCopy: _b, ...r }) => r as SnapRow),
		tables: by(tables, ({ id: _i, edition: _e, origin: _o, verified: _v, bookCopy: _b, ...r }) => r as SnapRow)
	};
}

export const hashOf = (s: Snapshot) => createHash('sha256').update(stable(s)).digest('hex').slice(0, 16);

/** An edition's latest version. */
export async function currentVersion(edition: string) {
	const [v] = await db.select().from(rulesVersion).where(eq(rulesVersion.edition, edition)).orderBy(desc(rulesVersion.createdAt)).limit(1);
	return v ?? null;
}

/** Record an edition's rules as they are now, unless they equal its latest version; returns its current version. */
export async function recordVersion(label: string, kind: 'book' | 'house' | 'baseline', edition: string) {
	const snapshot = await snapshotNow(edition);
	const hash = hashOf(snapshot);
	const latest = await currentVersion(edition);
	if (latest?.hash === hash) return latest;
	const [v] = await db.insert(rulesVersion).values({ edition, label: label.slice(0, 120), kind, hash, snapshot }).returning();
	return v;
}

/** At start: a baseline version for every edition that has rules and none yet; unpinned warbands pinned to their edition's. */
export async function ensureBaseline() {
	for (const e of await editions()) {
		const [anyUnit] = await db.select({ id: rulesUnit.id }).from(rulesUnit).where(eq(rulesUnit.edition, e.id)).limit(1);
		if (!anyUnit) continue;
		const v = (await currentVersion(e.id)) ?? (await recordVersion(e.name, 'baseline', e.id));
		await db.update(warband).set({ rulesVersion: v.id }).where(and(isNull(warband.rulesVersion), eq(warband.edition, e.id)));
	}
}

export async function versionById(id: string | null) {
	if (!id) return null;
	const [v] = await db.select().from(rulesVersion).where(eq(rulesVersion.id, id));
	return v ?? null;
}

export async function allVersions(edition: string) {
	return db
		.select({ id: rulesVersion.id, label: rulesVersion.label, kind: rulesVersion.kind, createdAt: rulesVersion.createdAt })
		.from(rulesVersion)
		.where(eq(rulesVersion.edition, edition))
		.orderBy(desc(rulesVersion.createdAt));
}

