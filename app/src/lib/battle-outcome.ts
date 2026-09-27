import type { SideResult } from './rules/types';

/** How a finished battle should look: who won, by how much, and how many fell. */
export interface Outcome {
	winner: string | null;
	loser: string | null;
	draw: boolean;
	/** Victory Points apart (Glorious Deeds when no VP were entered). */
	margin: number;
	/** 1 hard-fought, 2 decisive, 3 crushing. */
	tier: 1 | 2 | 3;
	fallen: { aggressor: number; defender: number };
	/** Bodies to draw on the field. */
	corpses: number;
}

export const MAX_CORPSES = 24;
export const TIER_NAMES = { 1: 'hard-fought victory', 2: 'decisive victory', 3: 'crushing victory' } as const;

export function outcome(g: {
	aggressorId: string;
	defenderId: string;
	winnerId: string | null;
	result: { sides: Record<string, SideResult> } | null;
}): Outcome {
	const a = g.result?.sides[g.aggressorId];
	const d = g.result?.sides[g.defenderId];
	const loser = g.winnerId ? (g.winnerId === g.aggressorId ? g.defenderId : g.aggressorId) : null;
	const byVp = a?.vp != null && d?.vp != null;
	const margin = Math.abs(byVp ? a!.vp! - d!.vp! : (a?.deeds ?? 0) - (d?.deeds ?? 0));
	const fallen = { aggressor: a?.fallen ?? 0, defender: d?.fallen ?? 0 };
	// A side that lost eight or more models was routed, whatever the points said.
	const lost = loser ? (loser === g.aggressorId ? fallen.aggressor : fallen.defender) : 0;
	const tier = margin >= 6 || lost >= 8 ? 3 : margin >= 3 ? 2 : 1;
	return {
		winner: g.winnerId,
		loser,
		draw: !g.winnerId,
		margin,
		tier,
		fallen,
		corpses: Math.min(MAX_CORPSES, fallen.aggressor + fallen.defender)
	};
}
