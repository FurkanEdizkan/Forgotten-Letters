/**
 * Rules versions (see $lib/rules-versions): a snapshot of the effective rules after each load of the books and
 * each Studio edit, made only when the rules actually changed; and what changed since the version a warband pins.
 */
import { createHash } from 'node:crypto';
import { desc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { rulesFaction, rulesItem, rulesPatron, rulesTable, rulesUnit, rulesVersion, warband } from './db/schema';
import { stable, type Snapshot, type SnapRow } from '$lib/rules-versions';

/** The effective rules now, keyed by stable id. */
export async function snapshotNow(): Promise<Snapshot> {
	const [units, items, factions, patrons, tables] = await Promise.all([
		db.select().from(rulesUnit),
		db.select().from(rulesItem),
		db.select().from(rulesFaction),
		db.select().from(rulesPatron),
		db.select().from(rulesTable)
	]);
	const by = <T extends { id: string }>(rows: T[], row: (r: T) => SnapRow) => Object.fromEntries(rows.map((r) => [r.id, row(r)]));
	return {
		units: by(units, ({ id: _i, origin: _o, verified: _v, bookCopy: _b, ...r }) => r as SnapRow),
		items: by(items, ({ id: _i, origin: _o, verified: _v, bookCopy: _b, ...r }) => r as SnapRow),
		factions: by(factions, ({ id: _i, origin: _o, verified: _v, ...r }) => ({ ...r, name: r.variant ?? r.faction }) as SnapRow),
		patrons: by(patrons, ({ id: _i, origin: _o, verified: _v, ...r }) => r as SnapRow),
		tables: by(tables, ({ id: _i, origin: _o, verified: _v, ...r }) => r as SnapRow)
	};
}

export const hashOf = (s: Snapshot) => createHash('sha256').update(stable(s)).digest('hex').slice(0, 16);

export async function currentVersion() {
	const [v] = await db.select().from(rulesVersion).orderBy(desc(rulesVersion.createdAt)).limit(1);
	return v ?? null;
}

/** Record the rules as they are now, unless they are the same as the latest version; returns the current version. */
export async function recordVersion(label: string, kind: 'book' | 'house' | 'baseline') {
	const snapshot = await snapshotNow();
	const hash = hashOf(snapshot);
	const latest = await currentVersion();
	if (latest?.hash === hash) return latest;
	const [v] = await db.insert(rulesVersion).values({ label: label.slice(0, 120), kind, hash, snapshot }).returning();
	return v;
}

/** At start: a baseline version if there is none (and rules exist), and every unpinned warband pinned to the current one. */
export async function ensureBaseline() {
	const [anyUnit] = await db.select({ id: rulesUnit.id }).from(rulesUnit).limit(1);
	if (!anyUnit) return null;
	const v = (await currentVersion()) ?? (await recordVersion('Rules as first recorded', 'baseline'));
	await db.update(warband).set({ rulesVersion: v.id }).where(isNull(warband.rulesVersion));
	return v;
}

export async function versionById(id: string | null) {
	if (!id) return null;
	const [v] = await db.select().from(rulesVersion).where(eq(rulesVersion.id, id));
	return v ?? null;
}

export async function allVersions() {
	return db.select({ id: rulesVersion.id, label: rulesVersion.label, kind: rulesVersion.kind, createdAt: rulesVersion.createdAt }).from(rulesVersion).orderBy(desc(rulesVersion.createdAt));
}

