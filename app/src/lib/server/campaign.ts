import { asc, eq, and } from 'drizzle-orm';
import { db } from './db';
import { adjustment, campaign, game, player, warband } from './db/schema';
import { replay } from '$lib/rules/engine';
import type {
	CampaignEvent,
	Effect,
	Exploration,
	Resource,
	RulesConfig,
	SideResult,
	WarbandInfo
} from '$lib/rules/types';

export type Campaign = typeof campaign.$inferSelect;
export type Warband = typeof warband.$inferSelect;
export type Player = typeof player.$inferSelect;
export type Game = typeof game.$inferSelect;

/** Single-campaign for now: the oldest campaign is the current one. */
export function currentCampaign(): Campaign | undefined {
	return db.select().from(campaign).orderBy(asc(campaign.createdAt)).limit(1).get();
}

export function rulesConfig(c: Campaign): RulesConfig {
	return {
		gamesPerPlayer: c.gamesPerPlayer,
		gloryScoring: c.gloryScoring,
		houseZones: c.houseZones,
		outpostLevy: c.houseOutpostLevy,
		razing: c.houseRazing
	};
}

export function rosters(campaignId: string) {
	return db
		.select({ warband, player })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(eq(warband.campaignId, campaignId))
		.orderBy(asc(player.seat), asc(player.name))
		.all();
}

export interface GameResult {
	sides: Record<string, SideResult>;
	scenarioRandom?: boolean;
}

export interface AdjustmentPayload {
	effects: Effect[];
	anyChoices?: Resource[];
	bonusExplorations?: Exploration[];
}

/** Completed games and adjustments as rules-engine events. */
export function campaignEvents(campaignId: string): CampaignEvent[] {
	const games = db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, campaignId), eq(game.status, 'done')))
		.all();
	const adjustments = db.select().from(adjustment).where(eq(adjustment.campaignId, campaignId)).all();

	const events: CampaignEvent[] = [];
	for (const g of games) {
		const r = (g.result ?? { sides: {} }) as GameResult;
		events.push({
			kind: 'game',
			id: g.id,
			at: (g.committedAt ?? g.createdAt).getTime(),
			zone: g.zone,
			aggressor: g.aggressorId,
			defender: g.defenderId,
			winner: g.winnerId,
			scenario: g.scenario ?? undefined,
			scenarioRandom: r.scenarioRandom,
			weatherEvent: g.weatherEvent ?? undefined,
			sides: r.sides
		});
	}
	for (const a of adjustments) {
		const p = (a.payload ?? { effects: [] }) as AdjustmentPayload;
		events.push({
			kind: 'adjustment',
			id: a.id,
			at: a.committedAt.getTime(),
			warband: a.warbandId,
			effects: p.effects ?? [],
			anyChoices: p.anyChoices,
			bonusExplorations: p.bonusExplorations,
			note: a.note ?? undefined
		});
	}
	return events;
}

export function warbandInfos(rows: { warband: Warband }[]): WarbandInfo[] {
	return rows.map(({ warband: w }) => ({
		id: w.id,
		entryZone: w.entryZone,
		vision: w.visionCard ?? undefined,
		visionLevel: w.visionProgress
	}));
}

/** Everything derived for a campaign. Contains secret Vision data — CM use only. */
export function loadCampaignState(c: Campaign) {
	const rows = rosters(c.id);
	const infos = warbandInfos(rows);
	const state = replay(infos, campaignEvents(c.id), rulesConfig(c));
	return { rows, infos, state };
}
