import { CONQUEST, GLORY_BOXES, GLORY_EXTRAS, RESOURCE_BOXES, resourceTrack } from './tracker';
import { lootFor } from './exploration';
import { buildGraph, type ZoneGraph } from './zones';
import {
	DEFAULT_CONFIG,
	type AdjustmentEvent,
	type Building,
	type CampaignEvent,
	type Effect,
	type Exploration,
	type GameEvent,
	type Resource,
	type Reward,
	type RulesConfig,
	type WarbandInfo
} from './types';

export type CvpSource = 'glory' | 'resources' | 'conquest' | 'other';

export interface PlayerState {
	id: string;
	entryZone: string;
	/** Glorious Deeds written per Glory box. */
	glory: number[];
	tracks: Record<Resource, number>;
	conquest: number;
	aggression: ('W' | 'L' | 'D')[];
	/** CVP entries on the Other track. */
	other: number[];
	cvp: Record<CvpSource, number>;
	dice: number;
	rerolls: number;
	sets: number;
	/** Scout Report: ±1 to Exploration Rolls. */
	rollMod: boolean;
	buildings: Record<Building, number>;
	scouted: string[];
	outposts: string[];
	omens: number;
	apocrypha: number;
	/** Glory gained/spent as recorded in the app (base-game Glory is on the roster). */
	gloryPoints: number;
	ducats: number;
	/** Hops the Aggressor may reach from Entry/Scouted zones (Personnel Carrier = 2). */
	reach: number;
	games: number;
	wins: number;
	aggressorWins: number;
	totalDeeds: number;
	maxDeeds: number;
	scenarios: { name: string; random: boolean }[];
	lastZone?: string;
}

export interface Prompt {
	eventId: string;
	warband: string;
	kind: 'fillAny' | 'explore';
	table?: Resource;
	source: string;
}

export interface CampaignState {
	config: RulesConfig;
	graph: ZoneGraph;
	players: Map<string, PlayerState>;
	/** Zones whose first-Outpost Omen has been taken. */
	omensTaken: Set<string>;
	/** Highest Glory Item cost unlocked for everyone by Territories merchants. */
	merchantTier: number;
	outpostsByZone: Map<string, string[]>;
	scoutedBy: Map<string, Set<string>>;
	/** Unresolved choices, for the post-game wizard. */
	pending: Prompt[];
	warnings: { eventId: string; message: string }[];
	gamesDone: number;
}

export function newPlayer(w: WarbandInfo): PlayerState {
	return {
		id: w.id,
		entryZone: w.entryZone,
		glory: [],
		tracks: { F: 0, R: 0, S: 0, T: 0 },
		conquest: 0,
		aggression: [],
		other: [],
		cvp: { glory: 0, resources: 0, conquest: 0, other: 0 },
		dice: 3,
		rerolls: 0,
		sets: 0,
		rollMod: false,
		buildings: { shrine: 0, vault: 0, depot: 0, garrison: 0 },
		scouted: [],
		outposts: [],
		omens: 0,
		apocrypha: 0,
		gloryPoints: 0,
		ducats: 0,
		reach: 1,
		games: 0,
		wins: 0,
		aggressorWins: 0,
		totalDeeds: 0,
		maxDeeds: 0,
		scenarios: []
	};
}

export const trackerCvp = (p: PlayerState) => p.cvp.glory + p.cvp.resources + p.cvp.conquest + p.cvp.other;

/** Supplies the recorded choices for rewards that need one, in trigger order. */
class Choices {
	private any: Resource[];
	private explorations: Exploration[];
	constructor(
		readonly eventId: string,
		readonly warband: string,
		any: Resource[] = [],
		explorations: Exploration[] = []
	) {
		this.any = [...any];
		this.explorations = [...explorations];
	}
	nextAny() {
		return this.any.shift();
	}
	nextExploration(table: Resource) {
		const i = this.explorations.findIndex((e) => e.table === table);
		return i < 0 ? undefined : this.explorations.splice(i, 1)[0];
	}
}

class Engine {
	cs: CampaignState;

	constructor(warbands: WarbandInfo[], config: RulesConfig) {
		this.cs = {
			config,
			graph: buildGraph(config.houseZones),
			players: new Map(warbands.map((w) => [w.id, newPlayer(w)])),
			omensTaken: new Set(),
			merchantTier: 0,
			outpostsByZone: new Map(),
			scoutedBy: new Map(),
			pending: [],
			warnings: [],
			gamesDone: 0
		};
	}

	warn(eventId: string, message: string) {
		this.cs.warnings.push({ eventId, message });
	}

	reward(p: PlayerState, r: Reward, source: CvpSource, ch: Choices) {
		switch (r.t) {
			case 'cvp':
				p.cvp[source] += r.n;
				break;
			case 'die':
				p.dice++;
				break;
			case 'reroll':
				p.rerolls++;
				break;
			case 'set':
				p.sets++;
				break;
			case 'fill':
				this.fill(p, r.track, ch);
				break;
			case 'fillAny': {
				const track = ch.nextAny();
				if (track) this.fill(p, track, ch);
				else this.cs.pending.push({ eventId: ch.eventId, warband: p.id, kind: 'fillAny', source: 'Tracker reward' });
				break;
			}
			case 'explore': {
				const exp = ch.nextExploration(r.table);
				if (exp) this.explore(p, exp, ch, false);
				else
					this.cs.pending.push({
						eventId: ch.eventId,
						warband: p.id,
						kind: 'explore',
						table: r.table,
						source: 'Tracker reward'
					});
				break;
			}
			case 'building':
				p.buildings[r.kind] = Math.min(3, p.buildings[r.kind] + 1);
				break;
		}
	}

	fill(p: PlayerState, track: Resource, ch: Choices) {
		const idx = p.tracks[track];
		if (idx >= RESOURCE_BOXES) {
			this.warn(ch.eventId, `${track} track already full`);
			return;
		}
		p.tracks[track]++;
		for (const r of resourceTrack(track)[idx]) this.reward(p, r, 'resources', ch);
	}

	scout(p: PlayerState, zone: string) {
		if (!p.scouted.includes(zone)) p.scouted.push(zone);
		const by = this.cs.scoutedBy.get(zone) ?? new Set();
		by.add(p.id);
		this.cs.scoutedBy.set(zone, by);
	}

	outpost(p: PlayerState, zoneId: string, eventId: string) {
		const zone = this.cs.graph.zones.get(zoneId);
		if (!zone || zone.type === 'entry') {
			this.warn(eventId, `No Outpost can be raised in ${zoneId}`);
			return;
		}
		if (p.outposts.includes(zoneId)) return;
		p.outposts.push(zoneId);
		this.scout(p, zoneId);
		const holders = this.cs.outpostsByZone.get(zoneId) ?? [];
		holders.push(p.id);
		this.cs.outpostsByZone.set(zoneId, holders);
		if (zone.omen === 'each' || (zone.omen === 'first' && !this.cs.omensTaken.has(zoneId))) {
			p.omens++;
			this.cs.omensTaken.add(zoneId);
		}
	}

	/** Remove an Outpost (Omens already taken are kept). */
	raze(p: PlayerState, zoneId: string) {
		p.outposts = p.outposts.filter((z) => z !== zoneId);
		const holders = (this.cs.outpostsByZone.get(zoneId) ?? []).filter((id) => id !== p.id);
		this.cs.outpostsByZone.set(zoneId, holders);
	}

	effect(p: PlayerState, e: Effect, ch: Choices, eventId: string) {
		switch (e.t) {
			case 'cvp':
				p.other.push(e.n);
				p.cvp.other += e.n;
				break;
			case 'glory':
				p.gloryPoints += e.n;
				break;
			case 'ducats':
				p.ducats += e.n;
				break;
			case 'fill':
				this.fill(p, e.track, ch);
				break;
			case 'omen':
				p.omens += e.n;
				break;
			case 'apocrypha':
				p.apocrypha += e.n;
				break;
			case 'die':
				p.dice++;
				break;
			case 'reroll':
				p.rerolls++;
				break;
			case 'set':
				p.sets++;
				break;
			case 'rollMod':
				p.rollMod = true;
				break;
			case 'reach2':
				p.reach = Math.max(p.reach, 2);
				break;
			case 'merchant':
				this.cs.merchantTier = Math.max(this.cs.merchantTier, e.tier);
				break;
			case 'building':
				p.buildings[e.kind] = Math.min(3, p.buildings[e.kind] + 1);
				break;
			case 'scout':
				this.scout(p, e.zone);
				break;
			case 'outpost':
				this.outpost(p, e.zone, eventId);
				break;
			case 'note':
				break;
		}
	}

	explore(p: PlayerState, exp: Exploration, ch: Choices, withLoot: boolean) {
		if (withLoot) p.ducats += lootFor(exp.total);
		for (const e of exp.effects) this.effect(p, e, ch, ch.eventId);
	}

	game(g: GameEvent) {
		const { cs } = this;
		const zone = cs.graph.zones.get(g.zone);
		const agg = cs.players.get(g.aggressor);
		const def = cs.players.get(g.defender);
		if (!zone || !agg || !def) {
			this.warn(g.id, 'Unknown zone or warband; game skipped');
			return;
		}
		const sides = [agg, def];
		const choices = new Map(
			sides.map((p) => {
				const s = g.sides[p.id];
				return [p.id, new Choices(g.id, p.id, s?.anyChoices, s?.bonusExplorations)];
			})
		);

		// Campaign Tracker Step
		for (const p of sides) {
			const s = g.sides[p.id] ?? { deeds: 0, fills: [] };
			const ch = choices.get(p.id)!;
			p.games++;
			p.lastZone = g.zone;
			if (g.scenario) p.scenarios.push({ name: g.scenario, random: !!g.scenarioRandom });
			p.totalDeeds += s.deeds;
			p.maxDeeds = Math.max(p.maxDeeds, s.deeds);

			const gi = p.glory.length;
			if (gi < GLORY_BOXES) {
				p.glory.push(s.deeds);
				const scoring = cs.config.gloryScoring;
				p.cvp.glory += scoring === 'boxIndex' ? gi + 1 : scoring === 'deeds' ? s.deeds : 0;
				for (const r of GLORY_EXTRAS[gi]) this.reward(p, r, 'glory', ch);
			}

			const allowed = p === agg && g.winner === agg.id ? 2 : 1;
			const fills = [...new Set(s.fills)].filter((r) => zone.resources.includes(r));
			if (fills.length !== s.fills.length) this.warn(g.id, `Invalid resource boxes for ${p.id}`);
			for (const r of fills.slice(0, allowed)) this.fill(p, r, ch);

			if (g.winner === p.id) {
				p.wins++;
				if (p.conquest < CONQUEST.length) {
					const ci = p.conquest++;
					for (const r of CONQUEST[ci]) this.reward(p, r, 'conquest', ch);
				}
			}
			if (p === agg) {
				p.aggression.push(g.winner === p.id ? 'W' : g.winner === null ? 'D' : 'L');
				if (g.winner === p.id) p.aggressorWins++;
			}
		}

		// Exploration Step
		this.scout(agg, g.zone);
		if (g.winner === def.id) this.scout(def, g.zone);
		for (const p of sides) {
			const s = g.sides[p.id];
			if (s?.exploration) this.explore(p, s.exploration, choices.get(p.id)!, true);
			if (cs.config.outpostLevy) p.ducats += 5 * suppliedOutposts(cs, p).zones.length;
		}

		// House rule Razing: instead of an Exploration table, strike out the defender's Outpost.
		if (g.sides[agg.id]?.raze) {
			if (!cs.config.razing) this.warn(g.id, 'Razing is not enabled for this campaign');
			else if (g.winner !== agg.id) this.warn(g.id, 'Only a winning Aggressor may raze');
			else if (!def.outposts.includes(g.zone)) this.warn(g.id, 'The defender holds no Outpost here');
			else this.raze(def, g.zone);
		}

		// Outposts Step
		if (g.winner) this.outpost(cs.players.get(g.winner)!, g.zone, g.id);

		cs.gamesDone++;
	}

	adjustment(a: AdjustmentEvent) {
		const p = this.cs.players.get(a.warband);
		if (!p) {
			this.warn(a.id, 'Unknown warband; adjustment skipped');
			return;
		}
		const ch = new Choices(a.id, p.id, a.anyChoices, a.bonusExplorations);
		for (const e of a.effects) this.effect(p, e, ch, a.id);
	}
}

export function sortEvents(events: CampaignEvent[]) {
	return [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export function replay(
	warbands: WarbandInfo[],
	events: CampaignEvent[],
	config: RulesConfig = DEFAULT_CONFIG
): CampaignState {
	const engine = new Engine(warbands, config);
	for (const e of sortEvents(events)) {
		if (e.kind === 'game') engine.game(e);
		else engine.adjustment(e);
	}
	return engine.cs;
}

/**
 * An Outpost is supplied if a chain of linked zones, each holding one of this
 * warband's Outposts, runs back to its Entry Zone.
 */
export function suppliedOutposts(cs: CampaignState, p: PlayerState) {
	const own = new Set(p.outposts);
	const seen = new Set<string>([p.entryZone]);
	const queue = [p.entryZone];
	const zones: string[] = [];
	while (queue.length) {
		const z = queue.shift()!;
		for (const n of cs.graph.adj.get(z) ?? []) {
			if (seen.has(n) || !own.has(n)) continue;
			seen.add(n);
			zones.push(n);
			queue.push(n);
		}
	}
	const weight = zones.reduce((sum, z) => sum + (cs.graph.zones.get(z)?.enclaveWeight ?? 1), 0);
	return { zones, weight };
}
