/**
 * An imported warband (Trench Companion text or JSON) names everything; this matches the names to the rules set's
 * ids: faction or variant, units, kit, upgrades, skills, injuries and Patron, case-insensitively and allowing a
 * plural, or by an alias. Kit becomes the line it is taken from (the faction's own, else a Mercenary's pool, else a
 * Glory or exploration line; `ambiguous` says where that choice had more than one). What does not match is
 * reported in `unmatched` with the fighter it belongs to, never silently dropped: an unknown fighter or item
 * cannot be held by id, so it is left out of the state and reported; unknown skills and injuries stay as text.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/tc-import.ts (matchToBook, factionByName) and
 * app/src/lib/patrons.ts (findPatron), rewritten to ids and the rules folder format.
 */
import { bestLine, linesFor } from './model.ts';
import { mergeSets, resolveFaction, type Resolved, type SetWithBase } from './resolve.ts';
import { letters, sameName } from './types.ts';
import type { Fighter, Group, Price, Status, WarbandState } from './types.ts';

export interface NamedFighter {
	unit: string;
	name?: string;
	group: Group;
	kit: string[];
	upgrades: string[];
	skills: string[];
	injuries: string[];
	xp: number;
	status?: Status;
	paid?: Price;
}

/** A warband as an import names it. */
export interface Named {
	name?: string;
	faction?: string;
	patron?: string;
	/** The "Rating: N Ducats | M Glory" line's ducats, when given. */
	rating?: number;
	ducats: number;
	glory: number;
	fighters: NamedFighter[];
	stash: string[];
	/** Pairs of indexes into `fighters`. */
	fireteams: [number, number][];
	locations: { name: string; note?: string }[];
}

/** By name or alias: exactly (letters only), else but for a plural. */
const find = <T extends { name: string; aliases?: string[] }>(xs: T[], n: string) => {
	const names = (x: T) => [x.name, ...(x.aliases ?? [])];
	return (
		xs.find((x) => names(x).some((a) => letters(a) === letters(n))) ??
		xs.find((x) => names(x).some((a) => sameName(a, n)))
	);
};

/** The thing a name means: exactly, else one whose name starts with it (a Patron's short name). */
export function findByName<T extends { name: string }>(
	xs: T[],
	n: string | undefined
): T | undefined {
	const k = letters(n ?? '');
	if (!k) return undefined;
	return (
		find(xs, n!) ?? xs.find((x) => letters(x.name).startsWith(k) || k.startsWith(letters(x.name)))
	);
}

/** A faction or variant by the name an export prints. */
/** Which faction an import goes into: a variant, or a dedication (a Sin) that lays one. */
export type Into = { factionId: string; variantId?: string; dedication?: string };

export function factionByName(set: SetWithBase, name: string | undefined) {
	const s = mergeSets(set);
	if (!name) return null;
	// Exact names first, so a faction is never taken for a variant whose name starts with it.
	const v = find(s.variants, name);
	const f = v ? undefined : (find(s.factions, name) ?? undefined);
	const v2 = v ?? (f ? undefined : findByName(s.variants, name));
	if (v2) {
		// A Sin's overlay is chosen as the faction's dedication, not as a variant.
		const ded = s.factions
			.find((x) => x.id === v2.faction)
			?.dedications?.find((d) => d.variant === v2.id);
		return ded
			? { factionId: v2.faction, variantId: undefined, dedication: ded.key }
			: { factionId: v2.faction, variantId: v2.id };
	}
	const f2 = f ?? findByName(s.factions, name);
	return f2 ? { factionId: f2.id, variantId: undefined } : null;
}

/** A skill or injury by name: a Patron Skill's id, a table row (`table:<id>#<roll>`), else undefined. */
export function skillRef(f: Resolved, n: string): string | undefined {
	for (const p of f.patrons) {
		const s = find(p.skills, n);
		if (s) return s.id;
	}
	for (const t of f.set.tables) {
		const r = find(t.rows, n.replace(/\s*\(.*\)\s*$/, ''));
		if (r) return `${t.id}#${r.roll}`;
	}
	return undefined;
}

export function matchNamed(
	named: Named,
	set: SetWithBase,
	into?: Into
): { state: WarbandState; unmatched: string[]; ambiguous: string[] } {
	const unmatched: string[] = [];
	// An item with more than one line in the source it was taken from: the first was taken, the player may change it.
	const ambiguous: string[] = [];
	const pick = (where: string, n: string, unit: Parameters<typeof bestLine>[1], itemId: string) => {
		const b = bestLine(f, unit, itemId);
		if (!b.line) unmatched.push(`${where}: ${n} is not in this warband's armoury`);
		else if (b.ambiguous)
			ambiguous.push(
				`${where}: ${n} from ${b.line.id} (also ${b.ambiguous
					.slice(1)
					.map((l) => l.id)
					.join(', ')})`
			);
		return b.line?.id;
	};
	const which = into ?? factionByName(set, named.faction);
	if (!which)
		throw new Error(`No faction or variant named "${named.faction ?? ''}" in these rules.`);
	const f = resolveFaction(set, which.factionId, which.variantId, which.dedication);
	const all = [...f.units, ...f.mercenaries, ...f.set.units];
	const kept: number[] = [];
	const fighters: Fighter[] = [];
	named.fighters.forEach((x, i) => {
		const label = x.name ? `${x.unit} - ${x.name}` : x.unit;
		const unit = find(all, x.unit);
		if (!unit) {
			unmatched.push(`Fighter: ${label}`);
			return;
		}
		const lines = linesFor(f, unit);
		const items = [...lines.map((l) => f.idx.items.get(l.item)!).filter(Boolean), ...f.set.items];
		const fixed = [...(unit.kit.fixed ?? [])];
		const kit: string[] = [];
		for (const n of x.kit) {
			const item = find(items, n);
			if (!item) unmatched.push(`${label}: item ${n}`);
			else if (fixed.includes(item.id)) fixed.splice(fixed.indexOf(item.id), 1);
			else {
				const line = pick(label, n, unit, item.id);
				if (line) kit.push(line);
			}
		}
		const upgrades: string[] = [];
		for (const n of x.upgrades) {
			const up = find(f.upgrades, n) ?? find(f.upgrades, n.replace(/\s*\([^)]*\)\s*$/, ''));
			if (up) upgrades.push(up.id);
			else unmatched.push(`${label}: upgrade ${n}`);
		}
		const refs = (ns: string[], what: string) =>
			ns.map((n) => {
				const r = skillRef(f, n);
				if (!r) unmatched.push(`${label}: ${what} ${n}`);
				return r ?? n;
			});
		kept[i] = fighters.length;
		fighters.push({
			id: `f${fighters.length + 1}`,
			unitId: unit.id,
			...(x.name && !sameName(x.name, unit.name) ? { name: x.name } : {}),
			group: x.group !== 'dead' && unit.category === 'mercenary' ? 'mercenary' : x.group,
			kit,
			upgrades,
			skills: refs(x.skills, 'skill'),
			injuries: refs(x.injuries, 'injury'),
			xp: x.xp,
			...(x.status && x.status !== 'active' ? { status: x.status } : {}),
			...(x.paid ? { paid: x.paid } : {})
		});
	});
	const stash: string[] = [];
	for (const n of named.stash) {
		const item = find(f.set.items, n);
		const line = item && pick('Stash', n, undefined, item.id);
		if (line) stash.push(line);
		else if (!item) unmatched.push(`Stash: item ${n}`);
	}
	const patron = named.patron ? findByName(f.set.patrons, named.patron) : undefined;
	if (named.patron && !patron) unmatched.push(`Patron: ${named.patron}`);
	const fireteams = named.fireteams
		.map(([a, b]) => [kept[a], kept[b]] as const)
		.filter((t): t is [number, number] => t[0] != null && t[1] != null)
		.map(([a, b]) => [fighters[a]!.id, fighters[b]!.id] as [string, string]);
	const state: WarbandState = {
		setId: f.set.manifest.id,
		...(named.name ? { name: named.name } : {}),
		factionId: f.faction.id,
		...(f.variant && !f.dedication ? { variantId: f.variant.id } : {}),
		...(f.dedication ? { dedication: f.dedication } : {}),
		...(patron ? { patronId: patron.id } : {}),
		// A warband well into a campaign is rated above its starting Ducats; its rating is the limit it has reached.
		ducatLimit: Math.max(f.rules.startDucats, named.rating ?? 0),
		stashDucats: named.ducats,
		unspentGlory: named.glory,
		fighters,
		stash,
		fireteams,
		locations: named.locations
	};
	return { state, unmatched, ambiguous };
}
