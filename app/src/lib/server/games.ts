import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { game } from './db/schema';
import { campaignEvents, currentCampaign, rosters, rulesConfig, warbandInfos, type Campaign, type Game, type GameResult } from './campaign';
import { replay, suppliedOutposts, trackerCvp, type PlayerState } from '$lib/rules/engine';
import { follyOffer } from '$lib/rules/exploration';
import type { GameEvent, SideResult } from '$lib/rules/types';

export interface Draft {
	winner: string | null;
	sides: Record<string, SideResult>;
}

function snapshot(p: PlayerState, cs: ReturnType<typeof replay>) {
	return {
		cvp: trackerCvp(p),
		tracks: p.tracks,
		dice: p.dice,
		rerolls: p.rerolls,
		sets: p.sets,
		ducats: p.ducats,
		gloryPoints: p.gloryPoints,
		omens: p.omens,
		buildings: p.buildings,
		outposts: p.outposts.length,
		outpostZones: p.outposts,
		supplied: suppliedOutposts(cs, p).zones.length
	};
}

export type Snapshot = ReturnType<typeof snapshot>;

export function toEvent(g: Game, draft: Draft, at: number): GameEvent {
	const r = (g.result ?? {}) as Partial<GameResult>;
	return {
		kind: 'game',
		id: g.id,
		at,
		zone: g.zone,
		aggressor: g.aggressorId,
		defender: g.defenderId,
		winner: draft.winner,
		scenario: g.scenario ?? undefined,
		scenarioRandom: r.scenarioRandom,
		weatherEvent: g.weatherEvent ?? undefined,
		sides: draft.sides
	};
}

/**
 * Replay the campaign with this game's draft result applied (as if committed now,
 * or at its original commit time) and report what it does and what it still needs.
 */
export function previewGame(c: Campaign, g: Game, draft: Draft) {
	const infos = warbandInfos(rosters(c.id));
	const others = campaignEvents(c.id).filter((e) => e.id !== g.id);
	const at = g.committedAt?.getTime() ?? Date.now();
	const before = replay(infos, others.filter((e) => e.at < at), rulesConfig(c));
	const after = replay(infos, [...others.filter((e) => e.at < at), toEvent(g, draft, at)], rulesConfig(c));

	const sides = [g.aggressorId, g.defenderId].map((id) => ({
		id,
		before: snapshot(before.players.get(id)!, before),
		after: snapshot(after.players.get(id)!, after),
		folly: id === g.defenderId && !!draft.sides[id]?.exploration && follyOffer(draft.sides[id].exploration!.dice)
	}));
	return {
		sides,
		pending: after.pending.filter((p) => p.eventId === g.id),
		warnings: after.warnings.filter((w) => w.eventId === g.id).map((w) => w.message)
	};
}

export function commitGame(g: Game, draft: Draft) {
	const prev = (g.result ?? {}) as Partial<GameResult>;
	const result: GameResult = { sides: draft.sides, scenarioRandom: prev.scenarioRandom };
	db.update(game)
		.set({
			status: 'done',
			winnerId: draft.winner,
			result,
			committedAt: g.committedAt ?? new Date()
		})
		.where(eq(game.id, g.id))
		.run();
}

/** Parse and sanity-check a draft posted from the result form. */
export function parseDraft(raw: unknown, g: Game): Draft | null {
	if (!raw || typeof raw !== 'object') return null;
	const d = raw as Draft;
	const ids = [g.aggressorId, g.defenderId];
	if (d.winner !== null && !ids.includes(d.winner)) return null;
	const sides: Record<string, SideResult> = {};
	for (const id of ids) {
		const s = d.sides?.[id];
		if (!s) return null;
		sides[id] = {
			deeds: Math.max(0, Math.floor(Number(s.deeds) || 0)),
			fills: Array.isArray(s.fills) ? s.fills : [],
			anyChoices: Array.isArray(s.anyChoices) ? s.anyChoices : [],
			exploration: s.exploration,
			bonusExplorations: Array.isArray(s.bonusExplorations) ? s.bonusExplorations : [],
			raze: s.raze === true && id === g.aggressorId
		};
	}
	return { winner: d.winner, sides };
}

export function findGame(id: string) {
	const c = currentCampaign();
	if (!c) error(404, 'No campaign');
	const g = db
		.select()
		.from(game)
		.where(and(eq(game.id, id), eq(game.campaignId, c.id)))
		.get();
	if (!g) error(404, 'No such game');
	return { c, g };
}
