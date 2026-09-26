import { suppliedOutposts, type CampaignState, type PlayerState } from './engine';

export interface Vision {
	id: string;
	name: string;
	levels: [string, string, string];
	thresholds?: [number, number, number];
	/** Metric computed from campaign state; Visions without one are levelled by the CM. */
	metric?: (cs: CampaignState, p: PlayerState) => number;
}

export const VISION_CVP = [10, 15, 20];

export const VISIONS: Vision[] = [
	{
		id: 'warlord', name: 'Warlord', levels: ['Win 2 games as Aggressor', 'Win 4', 'Win 8'],
		thresholds: [2, 4, 8], metric: (_, p) => p.aggressorWins
	},
	{
		id: 'legend', name: 'Legend', levels: ['Complete 9 Glorious Deeds', '18', '27'],
		thresholds: [9, 18, 27], metric: (_, p) => p.totalDeeds
	},
	{
		id: 'conqueror', name: 'Conqueror', levels: ['3 supplied Outposts', '5', '8'],
		thresholds: [3, 5, 8], metric: (cs, p) => suppliedOutposts(cs, p).zones.length
	},
	{ id: 'ascetic', name: 'Ascetic', levels: ['Hold at least 5 unspent Glory', '10', '25'] },
	{
		id: 'specialist', name: 'Specialist', levels: ['Own a Tier I building', 'Tier II', 'Tier III'],
		thresholds: [1, 2, 3], metric: (_, p) => Math.max(...Object.values(p.buildings))
	},
	{
		id: 'architect', name: 'Architect', levels: ['Own at least 1 Tier I building', '2', '4'],
		thresholds: [1, 2, 4], metric: (_, p) => Object.values(p.buildings).filter((t) => t >= 1).length
	},
	{ id: 'idol', name: 'Idol', levels: ['1 ELITE model with 2+ Glory Items', '3', '6'] },
	{
		id: 'explorer', name: 'Explorer', levels: ['2 zones Scouted by your Warband alone', '4', '6'],
		thresholds: [2, 4, 6], metric: (cs, p) => p.scouted.filter((z) => cs.scoutedBy.get(z)?.size === 1).length
	},
	{
		id: 'champion', name: 'Champion', levels: ['3 Glorious Deeds in a single game', '4', '6'],
		thresholds: [3, 4, 6], metric: (_, p) => p.maxDeeds
	},
	{ id: 'butcher', name: 'Butcher', levels: ['14 of your models dead', '30', '48'] },
	{
		id: 'raider', name: 'Raider', levels: ["Outposts in 1 zone that also holds another player's Outpost", '3', '5'],
		thresholds: [1, 3, 5], metric: (cs, p) => p.outposts.filter((z) => (cs.outpostsByZone.get(z)?.length ?? 0) > 1).length
	},
	{
		id: 'lion', name: 'Lion', levels: ['Play 2 different scenarios (up to 1 random counts)', '4', '8'],
		thresholds: [2, 4, 8],
		metric: (_, p) => {
			const named = new Set(p.scenarios.filter((s) => !s.random).map((s) => s.name));
			return named.size + (p.scenarios.some((s) => s.random) ? 1 : 0);
		}
	},
	{ id: 'veteran', name: 'Veteran', levels: ['Promote 1 model to ELITE', '3', '6'] },
	{ id: 'leader', name: 'Leader', levels: ['10 models', '18 models', 'More models than any other Warband'] },
	{ id: 'diplomat', name: 'Diplomat', levels: ['1 Mercenary', '2 Mercenaries', '2 ELITE Mercenaries'] },
	{ id: 'survivor', name: 'Survivor', levels: ['ELITEs: 6 Skills + 2 Battle Scars', '10 + 4', '15 + 7'] }
];

export const visionById = (id: string | undefined) => VISIONS.find((v) => v.id === id);

/** Achieved level (0–3): computed where possible, otherwise the CM's entry. */
export function visionLevel(cs: CampaignState, p: PlayerState, visionId: string | undefined, manual = 0) {
	const v = visionById(visionId);
	if (!v) return 0;
	if (!v.metric || !v.thresholds) return Math.max(0, Math.min(3, manual));
	const m = v.metric(cs, p);
	return v.thresholds.filter((t) => m >= t).length;
}

export const visionCvp = (level: number) => VISION_CVP.slice(0, level).reduce((a, b) => a + b, 0);
