/**
 * Rules versions: what the books said when a warband was built, and what changed since. A version is a snapshot
 * of the effective rules (units, armoury, faction and variant rules, Patrons, campaign tables) keyed by their
 * stable ids; two snapshots give the entries added, removed and changed, with the fields that changed.
 */
export type Kind = 'units' | 'items' | 'factions' | 'patrons' | 'tables';
export const KINDS: Kind[] = ['units', 'items', 'factions', 'patrons', 'tables'];

/** One entry as a version keeps it: what to name it and where it is filed, and its rules fields. */
export interface SnapRow {
	name: string;
	faction?: string | null;
	variant?: string | null;
	[field: string]: unknown;
}
export type Snapshot = Record<Kind, Record<string, SnapRow>>;

export interface FieldChange {
	field: string;
	from: string;
	to: string;
}
export interface EntryChange {
	kind: Kind;
	id: string;
	name: string;
	faction: string | null;
	variant: string | null;
	change: 'added' | 'removed' | 'changed';
	fields: FieldChange[];
}

/** Fields shown as "text changed" rather than in full. */
const TEXTY = new Set(['text', 'abilities', 'description', 'battlekitNote', 'rows', 'skills', 'restrictions', 'powers', 'paragraphs']);
/** Fields that say nothing about the rules (where a row came from, whether it was checked). */
const IGNORED = new Set(['origin', 'verified', 'bookCopy', 'id', 'name', 'faction', 'variant']);

/** A stable string of a value: objects with their keys sorted, so equal rules compare equal. */
export function stable(v: unknown): string {
	if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
	if (v && typeof v === 'object')
		return `{${Object.keys(v as object)
			.filter((k) => (v as Record<string, unknown>)[k] !== undefined && (v as Record<string, unknown>)[k] !== null)
			.sort()
			.map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
			.join(',')}}`;
	return JSON.stringify(v ?? null);
}

/** A short readable form of a field's value for the change list. */
function shown(v: unknown): string {
	if (v == null || v === '') return '—';
	if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' ? stable(x) : String(x))).join(', ') : '—';
	if (typeof v === 'object') return stable(v);
	return String(v);
}

/** The fields that differ between two versions of one entry. */
export function fieldChanges(a: SnapRow, b: SnapRow): FieldChange[] {
	const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !IGNORED.has(k)).sort();
	return keys.flatMap((k) => {
		if (stable(a[k]) === stable(b[k])) return [];
		return [TEXTY.has(k) ? { field: k, from: '', to: 'text changed' } : { field: k, from: shown(a[k]), to: shown(b[k]) }];
	});
}

/** Everything that changed from snapshot `a` to `b`. */
export function diff(a: Snapshot, b: Snapshot): EntryChange[] {
	const out: EntryChange[] = [];
	for (const kind of KINDS) {
		const before = a[kind] ?? {};
		const after = b[kind] ?? {};
		for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
			const x = before[id];
			const y = after[id];
			const row = (y ?? x)!;
			const base = { kind, id, name: row.name, faction: row.faction ?? null, variant: row.variant ?? null };
			if (!x) out.push({ ...base, change: 'added', fields: [] });
			else if (!y) out.push({ ...base, change: 'removed', fields: [] });
			else {
				const fields = fieldChanges(x, y);
				if (fields.length) out.push({ ...base, change: 'changed', fields });
			}
		}
	}
	return out;
}

/** What a warband is made of, to tell which changes touch it. */
export interface WarbandRef {
	faction: string;
	variant: string | null;
	/** Its models' entries (rules_unit ids) and names. */
	profileIds: string[];
	entryNames: string[];
	/** Names of the battlekit its models and arsenal hold. */
	itemNames: string[];
	patron: string | null;
}

const letters = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Split the changes into those that touch this warband (its entries, its kit, its faction or variant rules, its
 * Patron, the campaign tables) and the rest of its faction's; changes elsewhere are dropped.
 */
export function affecting(changes: EntryChange[], w: WarbandRef) {
	const names = new Set(w.entryNames.map(letters));
	const items = new Set(w.itemNames.map(letters));
	const mine: EntryChange[] = [];
	const faction: EntryChange[] = [];
	for (const c of changes) {
		const ours = c.faction === w.faction && (!c.variant || c.variant === w.variant);
		const touches =
			(c.kind === 'units' && (w.profileIds.includes(c.id) || (ours && names.has(letters(c.name))))) ||
			(c.kind === 'items' && items.has(letters(c.name))) ||
			(c.kind === 'factions' && ours) ||
			(c.kind === 'patrons' && !!w.patron && letters(c.name).startsWith(letters(w.patron))) ||
			c.kind === 'tables';
		if (touches) mine.push(c);
		else if (ours) faction.push(c);
	}
	return { mine, faction };
}
