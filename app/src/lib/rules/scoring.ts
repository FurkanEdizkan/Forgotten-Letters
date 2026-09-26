import { suppliedOutposts, trackerCvp, type CampaignState } from './engine';
import type { WarbandInfo } from './types';
import { visionCvp, visionLevel } from './visions';

/** Tied players split, rounding down, minimum 1. */
function award(scores: Map<string, number>, cvp: number) {
	const best = Math.max(0, ...scores.values());
	const out = new Map<string, number>();
	if (best <= 0) return out;
	const winners = [...scores].filter(([, s]) => s === best).map(([id]) => id);
	const each = Math.max(1, Math.floor(cvp / winners.length));
	for (const id of winners) out.set(id, each);
	return out;
}

export function sharedObjectives(cs: CampaignState) {
	const omens = new Map([...cs.players.values()].map((p) => [p.id, p.omens]));
	const enclave = new Map([...cs.players.values()].map((p) => [p.id, suppliedOutposts(cs, p).weight]));
	return { herald: award(omens, 6), enclave: award(enclave, 8) };
}

export interface Standing {
	id: string;
	trackerCvp: number;
	herald: number;
	enclave: number;
	/** Only present when Visions are revealed (or in the CM view). */
	visionLevel?: number;
	visionCvp?: number;
	total: number;
}

/**
 * Leaderboard. `revealVisions` must be false for any public response until the CM
 * triggers the endgame reveal — the Vision card is secret.
 */
export function standings(
	cs: CampaignState,
	warbands: WarbandInfo[],
	opts: { revealVisions: boolean; final: boolean }
): Standing[] {
	const shared = opts.final ? sharedObjectives(cs) : { herald: new Map(), enclave: new Map() };
	const rows = warbands.map((w) => {
		const p = cs.players.get(w.id)!;
		const row: Standing = {
			id: w.id,
			trackerCvp: trackerCvp(p),
			herald: shared.herald.get(w.id) ?? 0,
			enclave: shared.enclave.get(w.id) ?? 0,
			total: 0
		};
		if (opts.revealVisions) {
			row.visionLevel = visionLevel(cs, p, w.vision, w.visionLevel);
			row.visionCvp = visionCvp(row.visionLevel);
		}
		row.total = row.trackerCvp + row.herald + row.enclave + (row.visionCvp ?? 0);
		return row;
	});
	return rows.sort((a, b) => b.total - a.total);
}
