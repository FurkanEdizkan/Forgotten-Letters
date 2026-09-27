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
export async function currentCampaign(): Promise<Campaign | undefined> {
	return (await db.select().from(campaign).orderBy(asc(campaign.createdAt)).limit(1))[0];
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

export async function rosters(campaignId: string) {
	return (await db
		.select({ warband, player })
		.from(warband)
		.innerJoin(player, eq(player.id, warband.playerId))
		.where(eq(warband.campaignId, campaignId))
		.orderBy(asc(player.seat), asc(player.name))
		);
}

export interface GameResult {
	sides: Record<string, SideResult>;
	scenarioRandom?: boolean;
	/** Why the Aggressor is the Aggressor: fewer times so far, a roll-off, or chosen by the CM. */
	aggressorReason?: 'fewer' | 'roll-off' | 'chosen';
}

export interface AdjustmentPayload {
	effects: Effect[];
	anyChoices?: Resource[];
	bonusExplorations?: Exploration[];
}

/** Completed games and adjustments as rules-engine events. */
export async function campaignEvents(campaignId: string): Promise<CampaignEvent[]> {
	const games = (await db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, campaignId), eq(game.status, 'done')))
		);
	const adjustments = (await db.select().from(adjustment).where(eq(adjustment.campaignId, campaignId)));

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
		entryZone: w.entryZone ?? '',
		vision: w.visionCard ?? undefined,
		visionLevel: w.visionProgress
	}));
}

/** Everything derived for a campaign. Contains secret Vision data — CM use only. */
export async function loadCampaignState(c: Campaign) {
	const rows = await rosters(c.id);
	const infos = warbandInfos(rows);
	const state = replay(infos, await campaignEvents(c.id), rulesConfig(c));
	return { rows, infos, state };
}
