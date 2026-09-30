/**
 * A round of battles: who may fight, who the Aggressors are, and the order they pick in.
 *
 * Aggressors are half the field (rounded down). Whoever has been Aggressor fewer times goes first (the book's
 * rule); among equals the higher D6 wins, and a tie that decides anything — who is an Aggressor, or the order
 * the Aggressors pick in — is rolled again by the tied players only. The unpicked non-Aggressor of an odd field
 * sits the round out.
 */

export interface RoundEntry {
	id: string;
	/** Times this warband has been Aggressor so far. */
	aggressions: number;
	/** Its D6 rolls this round: the first roll, then any re-rolls, in order. */
	rolls: number[];
}

export function eligibleForRound(warbands: { id: string; games: number; busy: boolean }[], gamesPerPlayer: number): string[] {
	return warbands.filter((w) => w.games < gamesPerPlayer && !w.busy).map((w) => w.id);
}

export const aggressorCount = (n: number) => Math.floor(n / 2);

const rollAt = (e: RoundEntry, i: number) => e.rolls[i] ?? 0;
const sameStanding = (a: RoundEntry, b: RoundEntry) =>
	a.aggressions === b.aggressions && a.rolls.length === b.rolls.length && a.rolls.every((r, i) => r === b.rolls[i]);

/** Fewer times Aggressor first; then the higher roll, then the higher re-roll, and so on. */
export function rankEntries<T extends RoundEntry>(entries: T[]): T[] {
	return [...entries].sort((a, b) => {
		if (a.aggressions !== b.aggressions) return a.aggressions - b.aggressions;
		for (let i = 0; i < Math.max(a.rolls.length, b.rolls.length); i++) if (rollAt(a, i) !== rollAt(b, i)) return rollAt(b, i) - rollAt(a, i);
		return 0;
	});
}

/**
 * What the roll-off still needs: who has yet to roll (nobody has rolled, or someone they are tied with has
 * already re-rolled), and — once nobody is waiting — which tied players must roll again.
 */
export function rollOffNeeded(entries: RoundEntry[]): { waiting: string[]; reroll: string[] } {
	const waiting = entries
		.filter(
			(x) =>
				!x.rolls.length ||
				entries.some((y) => y !== x && y.aggressions === x.aggressions && y.rolls.length > x.rolls.length && x.rolls.every((r, i) => r === y.rolls[i]))
		)
		.map((x) => x.id);
	if (waiting.length) return { waiting, reroll: [] };
	const ranked = rankEntries(entries);
	const cut = aggressorCount(entries.length);
	const reroll = new Set<string>();
	ranked.forEach((x, i) => {
		if (i >= cut) return;
		const tied = ranked.filter((y) => y !== x && sameStanding(x, y));
		if (tied.length) [x, ...tied].forEach((t) => reroll.add(t.id));
	});
	return { waiting: [], reroll: ranked.filter((x) => reroll.has(x.id)).map((x) => x.id) };
}

/** The Aggressor whose turn it is to pick an opponent (and a battlefield), in rank order; null when all have. */
export function nextPicker(aggressorsInOrder: string[], picked: Set<string>): string | null {
	return aggressorsInOrder.find((id) => !picked.has(id)) ?? null;
}

/** Non-Aggressors nobody picked: they sit this round out. */
export function byes(defenders: string[], taken: Set<string>): string[] {
	return defenders.filter((id) => !taken.has(id));
}

/** The round a warband plays next: battles fought plus rounds passed, plus one. */
export const playerRound = (games: number, passes: number) => games + passes + 1;

/** A round entry with the warband's own round: warbands are only paired with others on the same round. */
export interface GroupedEntry extends RoundEntry {
	round: number;
}

function byRound<T extends GroupedEntry>(entries: T[]): T[][] {
	const groups = new Map<number, T[]>();
	for (const e of entries) groups.set(e.round, [...(groups.get(e.round) ?? []), e]);
	return [...groups.entries()].sort(([a], [b]) => a - b).map(([, es]) => es);
}

/** The roll-off, checked group by group: only ties that decide something within a round group re-roll. */
export function rollOffByGroup(entries: GroupedEntry[]): { waiting: string[]; reroll: string[] } {
	const out = { waiting: [] as string[], reroll: [] as string[] };
	for (const group of byRound(entries)) {
		const need = rollOffNeeded(group);
		out.waiting.push(...need.waiting);
		out.reroll.push(...need.reroll);
	}
	return out;
}

export type Role = { role: 'aggressor' | 'defender'; pickOrder: number | null };

/**
 * Roles once the roll-off is settled: in each round group, the top half (rounded down) are Aggressors. Groups
 * that are behind pick first, then rank order within the group. A warband alone on its round is left waiting.
 */
export function assignRoles(entries: GroupedEntry[]): Map<string, Role> {
	const roles = new Map<string, Role>();
	let order = 0;
	for (const group of byRound(entries)) {
		const ranked = rankEntries(group);
		const cut = aggressorCount(ranked.length);
		ranked.forEach((e, i) => roles.set(e.id, i < cut ? { role: 'aggressor', pickOrder: ++order } : { role: 'defender', pickOrder: null }));
	}
	return roles;
}

/**
 * Whom an Aggressor may challenge: non-Aggressors on the same round who have no battle or pending challenge
 * (`taken`), less those who declined this Aggressor this round (`declined` holds "aggressor>defender" pairs).
 */
export function freeOpponents(
	aggressor: string,
	entries: GroupedEntry[],
	roles: Map<string, Role>,
	{ taken, declined }: { taken: Set<string>; declined: Set<string> }
): string[] {
	const mine = entries.find((e) => e.id === aggressor);
	if (!mine) return [];
	return entries
		.filter((e) => e.round === mine.round && roles.get(e.id)?.role === 'defender' && !taken.has(e.id) && !declined.has(`${aggressor}>${e.id}`))
		.map((e) => e.id);
}
