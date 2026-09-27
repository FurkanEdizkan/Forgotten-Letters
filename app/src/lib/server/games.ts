import { error } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { db } from './db';
import { game } from './db/schema';
import { campaignEvents, currentCampaign, loadCampaignState, rosters, rulesConfig, warbandInfos, type Campaign, type Game, type GameResult } from './campaign';
import { regionEventFor } from './fx';
import { suggestAggressor, zoneOptions } from '$lib/rules/legality';
import { d6, weatherByRoll, weatherChooser } from '$lib/rules/weather';
import { randomScenario } from '$lib/rules/scenario';
import { buildGraph } from '$lib/rules/zones';
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
export async function previewGame(c: Campaign, g: Game, draft: Draft) {
	const infos = warbandInfos(await rosters(c.id));
	const others = (await campaignEvents(c.id)).filter((e) => e.id !== g.id);
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

export async function commitGame(g: Game, draft: Draft) {
	const prev = (g.result ?? {}) as Partial<GameResult>;
	const result: GameResult = { ...prev, sides: draft.sides };
	(await db.update(game)
		.set({
			status: 'done',
			winnerId: draft.winner,
			result,
			committedAt: g.committedAt ?? new Date()
		})
		.where(eq(game.id, g.id))
		);
}

const count = (v: unknown) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Math.min(99, Math.floor(Number(v)))));

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
			raze: s.raze === true && id === g.aggressorId,
			vp: count(s.vp),
			fallen: count(s.fallen)
		};
	}
	return { winner: d.winner, sides };
}

export async function findGame(id: string) {
	const c = await currentCampaign();
	if (!c) error(404, 'No campaign');
	const g = (await db
		.select()
		.from(game)
		.where(and(eq(game.id, id), eq(game.campaignId, c.id)))
		)[0];
	if (!g) error(404, 'No such game');
	return { c, g };
}

// ---------------------------------------------------------------- planning battles (wizard + map)

export class BattleError extends Error {}

/** Warbands already on the field in a game that isn't recorded yet. */
export async function busyWarbands(campaignId: string) {
	const busy = new Set<string>();
	for (const g of (await db.select().from(game).where(and(eq(game.campaignId, campaignId), ne(game.status, 'done'))))) {
		busy.add(g.aggressorId);
		busy.add(g.defenderId);
	}
	return busy;
}

export interface PlanInput {
	aggressor: string;
	defender: string;
	zone: string;
	override?: boolean;
	status?: 'scheduled' | 'in_progress';
	scenario?: string | null;
	scenarioRandom?: boolean;
	weatherEvent?: number | null;
	weatherRolls?: unknown;
}

/** Validate and create a battle: legal zone, warbands free and with games left (unless overridden). */
export async function planGame(c: Campaign, input: PlanInput): Promise<Game> {
	const { state } = await loadCampaignState(c);
	const { aggressor, defender, zone } = input;
	if (!state.players.has(aggressor) || !state.players.has(defender) || aggressor === defender)
		throw new BattleError('Choose two different warbands');
	const busy = await busyWarbands(c.id);
	if (busy.has(aggressor) || busy.has(defender))
		throw new BattleError('One of these warbands is already on the field — record or cancel that game first.');
	const spent = [aggressor, defender].filter((id) => state.players.get(id)!.games >= c.gamesPerPlayer);
	if (spent.length && !input.override)
		throw new BattleError(`Already played all ${c.gamesPerPlayer} campaign games. Tick "override" to allow an extra game.`);
	const option = zoneOptions(state, aggressor, defender).find((o) => o.zone === zone);
	if (!option) throw new BattleError('Choose a zone');
	if (!option.legal && !input.override) throw new BattleError(`${zone}: ${option.reason}. Tick "override" to allow it anyway.`);

	const suggested = suggestAggressor(state, aggressor, defender);
	const result: GameResult = {
		sides: {},
		scenarioRandom: !!input.scenarioRandom,
		aggressorReason: suggested === aggressor ? 'fewer' : suggested === null ? 'roll-off' : 'chosen'
	};
	const zoneDef = state.graph.zones.get(zone)!;
	return (await db
		.insert(game)
		.values({
			campaignId: c.id,
			status: input.status ?? 'scheduled',
			zone,
			aggressorId: aggressor,
			defenderId: defender,
			scenario: input.scenario ?? zoneDef.scenario ?? null,
			weatherEvent: input.weatherEvent && weatherByRoll(input.weatherEvent) ? input.weatherEvent : (await regionEventFor(c.id, zone) ?? null),
			weatherRolls: input.weatherRolls ?? null,
			result
		})
		.returning()
		)[0];
}

export interface WeatherRolls {
	aggressor: [number, number] | null;
	defender: [number, number] | null;
	/** Warband that picks which roll applies (fewest tracker CVP); null = tied, roll off. */
	chooser: string | null;
	rolledAt: number;
}

/** Roll 2D6 for both players on the server (so nobody can fake it) and record who chooses. */
export async function rollWeather(c: Campaign, g: Game): Promise<WeatherRolls> {
	if (g.status === 'done') throw new BattleError('This battle is already recorded');
	const { state } = await loadCampaignState(c);
	const cvp = (id: string) => trackerCvp(state.players.get(id)!);
	const rolls: WeatherRolls = {
		aggressor: [d6(), d6()],
		defender: [d6(), d6()],
		chooser: weatherChooser({ id: g.aggressorId, cvp: cvp(g.aggressorId) }, { id: g.defenderId, cvp: cvp(g.defenderId) }),
		rolledAt: Date.now()
	};
	(await db.update(game).set({ weatherRolls: rolls, weatherEvent: null }).where(eq(game.id, g.id)));
	return rolls;
}

export async function setWeather(g: Game, event: number | null) {
	if (event !== null && !weatherByRoll(event)) throw new BattleError('Unknown Hell on Earth event');
	(await db.update(game).set({ weatherEvent: event }).where(eq(game.id, g.id)));
}

export async function rollScenario(c: Campaign, g: Game) {
	const zone = buildGraph(c.houseZones).zones.get(g.zone);
	if (!zone?.archetype) throw new BattleError('This zone has a fixed scenario');
	const s = randomScenario(zone.archetype, d6(), d6(), c.randomScenarioTurns);
	const prev = (g.result ?? { sides: {} }) as GameResult;
	(await db.update(game)
		.set({ scenario: s.name, result: { ...prev, scenarioRandom: true } })
		.where(eq(game.id, g.id))
		);
	return s;
}

export async function swapSides(g: Game) {
	if (g.status !== 'scheduled') throw new BattleError('Sides can only be swapped before the battle starts');
	const prev = (g.result ?? { sides: {} }) as GameResult;
	(await db.update(game)
		.set({ aggressorId: g.defenderId, defenderId: g.aggressorId, result: { ...prev, aggressorReason: 'chosen' } })
		.where(eq(game.id, g.id))
		);
}

export async function startGame(g: Game) {
	if (g.status !== 'scheduled') throw new BattleError('Only a planned battle can start');
	(await db.update(game).set({ status: 'in_progress' }).where(eq(game.id, g.id)));
}

export async function cancelGame(g: Game) {
	if (g.status === 'done') throw new BattleError('Recorded battles are deleted from the Games page');
	(await db.delete(game).where(eq(game.id, g.id)));
}
