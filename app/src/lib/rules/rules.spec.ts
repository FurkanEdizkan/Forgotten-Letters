import { describe, expect, it } from 'vitest';
import { replay, suppliedOutposts, trackerCvp } from './engine';
import { follyOffer, lookup } from './exploration';
import { suggestAggressor, zoneOptions } from './legality';
import { randomScenario } from './scenario';
import { sharedObjectives, standings } from './scoring';
import { ALL_ZONES, BOOK_ZONE_IDS, buildGraph } from './zones';
import { weatherByRoll, weatherChooser } from './weather';
import type { CampaignEvent, GameEvent, SideResult, WarbandInfo } from './types';

const wb = (id: string, entryZone: string, vision?: string): WarbandInfo => ({ id, entryZone, vision });

let t = 0;
function game(
	zone: string,
	aggressor: string,
	defender: string,
	winner: string | null,
	sides: Record<string, Partial<SideResult>> = {}
): GameEvent {
	const full: Record<string, SideResult> = {};
	for (const id of [aggressor, defender]) full[id] = { deeds: 0, fills: [], ...sides[id] };
	return { kind: 'game', id: `g${++t}`, at: t, zone, aggressor, defender, winner, sides: full };
}

describe('zones', () => {
	it('book links are listed symmetrically on the printed map', () => {
		const book = ALL_ZONES.filter((z) => BOOK_ZONE_IDS.has(z.id));
		const byId = new Map(book.map((z) => [z.id, z]));
		const oneSided: string[] = [];
		for (const z of book)
			for (const l of z.links) {
				expect(byId.has(l), `${z.id} → ${l}`).toBe(true);
				if (!byId.get(l)!.links.includes(z.id)) oneSided.push(`${z.id} → ${l}`);
			}
		expect(oneSided).toEqual([]);
	});

	it('house links point at real zones', () => {
		const g = buildGraph(true);
		for (const z of ALL_ZONES) for (const l of z.links) expect(g.zones.has(l), `${z.id} → ${l}`).toBe(true);
	});

	it('has 32 battle zones on the book map, 10 of them Special', () => {
		const book = ALL_ZONES.filter((z) => BOOK_ZONE_IDS.has(z.id) && z.type !== 'entry');
		expect(book).toHaveLength(32);
		expect(book.filter((z) => z.type === 'special')).toHaveLength(10);
	});

	it('house zones can be switched off', () => {
		const g = buildGraph(false);
		expect(g.zones.has('E')).toBe(false);
		expect(g.adj.get('A')!.has('hermits-stair')).toBe(false);
	});
});

describe("Player's Guide worked example", () => {
	// P1 (Aggressor) beats P7 in Domus Demetrius; P1 rolls 15 on Supplies → Breaker King Tithe.
	const warbands = [wb('p1', 'A'), wb('p7', 'C')];
	const events: CampaignEvent[] = [
		game('domus-demetrius', 'p1', 'p7', 'p1', {
			p1: {
				deeds: 3,
				fills: ['F', 'T'],
				anyChoices: ['S'],
				exploration: { table: 'S', dice: [4, 5, 6], total: 15, result: 'Breaker King Tithe', effects: [{ t: 'fill', track: 'S' }] }
			},
			p7: { deeds: 1, fills: ['S'], exploration: { dice: [3, 3, 3], total: 9, effects: [] } }
		})
	];
	const cs = replay(warbands, events);
	const p1 = cs.players.get('p1')!;
	const p7 = cs.players.get('p7')!;

	it('fills tracker boxes and scores CVP', () => {
		expect(p1.glory).toEqual([3]);
		expect(p1.cvp.glory).toBe(1); // box 1 scores 1
		expect(p1.cvp.conquest).toBe(3);
		// Conquest box 1 +any → S, Breaker King Tithe +S → S track at 2 boxes.
		expect(p1.tracks).toEqual({ F: 1, R: 0, S: 2, T: 1 });
		expect(p1.aggression).toEqual(['W']);
	});

	it('S box 2 owes a Supplies exploration roll', () => {
		expect(cs.pending).toContainEqual(expect.objectContaining({ warband: 'p1', kind: 'explore', table: 'S' }));
	});

	it('pays loot of roll × 5 Ducats', () => {
		expect(p1.ducats).toBe(75);
		expect(p7.ducats).toBe(45);
	});

	it('scouts and raises the Outpost, taking Domus’s Omen', () => {
		expect(p1.scouted).toContain('domus-demetrius');
		expect(p7.scouted).not.toContain('domus-demetrius');
		expect(p1.outposts).toEqual(['domus-demetrius']);
		expect(p1.omens).toBe(1);
		expect(suppliedOutposts(cs, p1)).toEqual({ zones: ['domus-demetrius'], weight: 2 });
	});

	it('defender triples meet Rudolf’s Folly', () => {
		expect(follyOffer([3, 3, 3])).toBe(true);
		expect(follyOffer([3, 3, 4])).toBe(false);
		expect(lookup('S', 15).name).toBe('Breaker King Tithe');
		expect(lookup('F', 40).name).toBe('Chosen Blessing');
	});
});

describe('tracker rewards', () => {
	it('Glory box 5 grants +1 Exploration die; box n scores n', () => {
		const events = [1, 2, 3, 4, 5].map(() => game('sacred-plains', 'a', 'b', 'b', { a: { deeds: 2, fills: ['R'] } }));
		const cs = replay([wb('a', 'A'), wb('b', 'A')], events);
		const a = cs.players.get('a')!;
		expect(a.dice).toBe(4);
		expect(a.cvp.glory).toBe(15);
		expect(cs.pending.filter((p) => p.warband === 'a' && p.kind === 'fillAny')).toHaveLength(1); // box 3
	});

	it('glory scoring by deeds and none', () => {
		const events = [game('sacred-plains', 'a', 'b', null, { a: { deeds: 4, fills: ['R'] } })];
		const ws = [wb('a', 'A'), wb('b', 'A')];
		const base = { gamesPerPlayer: 8, houseZones: true, outpostLevy: false, razing: false };
		expect(replay(ws, events, { ...base, gloryScoring: 'deeds' }).players.get('a')!.cvp.glory).toBe(4);
		expect(replay(ws, events, { ...base, gloryScoring: 'none' }).players.get('a')!.cvp.glory).toBe(0);
	});

	it('resource boxes chain: F box 3 = Shrine 1 + 5 CVP, box 4 fills R', () => {
		const events: CampaignEvent[] = [
			{
				kind: 'adjustment', id: 'x', at: 1, warband: 'a',
				effects: [{ t: 'fill', track: 'F' }, { t: 'fill', track: 'F' }, { t: 'fill', track: 'F' }, { t: 'fill', track: 'F' }],
				bonusExplorations: [{ table: 'F', dice: [1, 1, 1], total: 3, effects: [] }]
			}
		];
		const a = replay([wb('a', 'A')], events).players.get('a')!;
		expect(a.buildings.shrine).toBe(1);
		expect(a.tracks.R).toBe(1);
		expect(a.cvp.resources).toBe(5);
	});

	it('only the zone’s resources can be marked; 2 boxes only for a winning Aggressor', () => {
		const cs = replay(
			[wb('a', 'A'), wb('b', 'A')],
			[game('domus-demetrius', 'a', 'b', 'b', { a: { deeds: 0, fills: ['F', 'T'] }, b: { deeds: 0, fills: ['R'] } })]
		);
		expect(cs.players.get('a')!.tracks).toEqual({ F: 1, R: 0, S: 0, T: 0 });
		expect(cs.players.get('b')!.tracks.R).toBe(0);
		expect(cs.warnings.length).toBeGreaterThan(0);
	});

	it('12 Conquest boxes score 60 CVP', () => {
		const events = Array.from({ length: 12 }, () => game('sacred-plains', 'a', 'b', 'a', { a: { deeds: 0, fills: ['R'] } }));
		const a = replay([wb('a', 'A'), wb('b', 'A')], events).players.get('a')!;
		expect(a.cvp.conquest).toBe(60);
	});
});

describe('omens and enclaves', () => {
	it('only the first Outpost at an Omen zone takes the Omen', () => {
		const cs = replay(
			[wb('a', 'A'), wb('b', 'A')],
			[game('domus-demetrius', 'a', 'b', 'a'), game('domus-demetrius', 'b', 'a', 'b')]
		);
		expect(cs.players.get('a')!.omens).toBe(1);
		expect(cs.players.get('b')!.omens).toBe(0);
		expect(cs.players.get('b')!.outposts).toEqual(['domus-demetrius']);
	});

	it('supply chains must run back to the Entry Zone', () => {
		const cs = replay(
			[wb('a', 'A'), wb('b', 'D')],
			[game('sacred-plains', 'a', 'b', 'a'), game('shadow-of-old-saints', 'a', 'b', 'a'), game('vivarium', 'a', 'b', 'a')]
		);
		const a = cs.players.get('a')!;
		expect(a.outposts).toHaveLength(3);
		expect(suppliedOutposts(cs, a).zones.sort()).toEqual(['sacred-plains', 'shadow-of-old-saints']);
	});

	it('shared objectives split ties, rounding down, minimum 1', () => {
		const cs = replay(
			[wb('a', 'A'), wb('b', 'D'), wb('c', 'C')],
			[
				{ kind: 'adjustment', id: 'o1', at: 1, warband: 'a', effects: [{ t: 'omen', n: 1 }] },
				{ kind: 'adjustment', id: 'o2', at: 2, warband: 'b', effects: [{ t: 'omen', n: 1 }] }
			]
		);
		const { herald } = sharedObjectives(cs);
		expect(Object.fromEntries(herald)).toEqual({ a: 3, b: 3 });
	});
});

describe('house rule: Razing', () => {
	const ws = [wb('a', 'A'), wb('b', 'A')];
	const cfg = { gamesPerPlayer: 8, gloryScoring: 'boxIndex' as const, houseZones: true, outpostLevy: false };
	const events = [
		game('sacred-plains', 'b', 'a', 'b'),
		game('sacred-plains', 'a', 'b', 'a', { a: { deeds: 0, fills: ['R'], raze: true } })
	];

	it('a winning Aggressor strikes out the defender\u2019s Outpost', () => {
		const cs = replay(ws, events, { ...cfg, razing: true });
		expect(cs.players.get('b')!.outposts).toEqual([]);
		expect(cs.players.get('a')!.outposts).toEqual(['sacred-plains']);
		expect(cs.outpostsByZone.get('sacred-plains')).toEqual(['a']);
	});

	it('does nothing unless the campaign enables it', () => {
		const cs = replay(ws, events, { ...cfg, razing: false });
		expect(cs.players.get('b')!.outposts).toEqual(['sacred-plains']);
		expect(cs.warnings.some((w) => w.message.includes('Razing'))).toBe(true);
	});
});

describe('legality', () => {
	it('first game: zones linked to the Entry Zone', () => {
		const cs = replay([wb('a', 'A'), wb('b', 'B')], []);
		const legal = zoneOptions(cs, 'a', 'b').filter((o) => o.legal).map((o) => o.zone).sort();
		expect(legal).toEqual(['domus-demetrius', 'hermits-stair', 'sacred-plains']);
	});

	it('scouted zones open their links', () => {
		const cs = replay([wb('a', 'A'), wb('b', 'B')], [game('sacred-plains', 'a', 'b', 'b')]);
		const legal = new Set(zoneOptions(cs, 'a', 'b').filter((o) => o.legal).map((o) => o.zone));
		expect(legal.has('shadow-of-old-saints')).toBe(true);
		expect(legal.has('kurd-dagh')).toBe(false);
	});

	it('Personnel Carrier reaches 2 away', () => {
		const cs = replay([wb('a', 'A'), wb('b', 'B')], [{ kind: 'adjustment', id: 'pc', at: 1, warband: 'a', effects: [{ t: 'reach2' }] }]);
		const legal = new Set(zoneOptions(cs, 'a', 'b').filter((o) => o.legal).map((o) => o.zone));
		expect(legal.has('shadow-of-old-saints')).toBe(true);
	});

	it('Altar of Leviathan only as both players’ final game, both with an Omen', () => {
		const ws = [wb('a', 'E'), wb('b', 'E')];
		const omens: CampaignEvent[] = ['a', 'b'].map((w, i) => ({ kind: 'adjustment', id: `o${w}`, at: i, warband: w, effects: [{ t: 'omen', n: 1 }] }));
		const early = replay(ws, omens);
		expect(zoneOptions(early, 'a', 'b').find((o) => o.zone === 'altar-of-leviathan')!.legal).toBe(false);
		const seven = Array.from({ length: 7 }, () => game('amoudet-seawall', 'a', 'b', null));
		const late = replay(ws, [...omens, ...seven]);
		expect(zoneOptions(late, 'a', 'b').find((o) => o.zone === 'altar-of-leviathan')!.legal).toBe(true);
	});

	it('fewer times Aggressor is the Aggressor', () => {
		const cs = replay([wb('a', 'A'), wb('b', 'B')], [game('sacred-plains', 'a', 'b', 'a')]);
		expect(suggestAggressor(cs, 'a', 'b')).toBe('b');
		expect(suggestAggressor(replay([wb('a', 'A'), wb('b', 'B')], []), 'a', 'b')).toBeNull();
	});
});

describe('weather and scenarios', () => {
	it('fewest CVP chooses the weather; ties roll off', () => {
		expect(weatherChooser({ id: 'a', cvp: 4 }, { id: 'b', cvp: 9 })).toBe('a');
		expect(weatherChooser({ id: 'a', cvp: 4 }, { id: 'b', cvp: 4 })).toBeNull();
		expect(weatherByRoll(10)!.name).toBe('Smog Storm');
	});

	it('random scenario generator', () => {
		const s = randomScenario('trench-lines', 3, 6, 4);
		expect(s).toMatchObject({ deployment: 'Tunnels', victory: 'Over the Top', turns: 4 });
	});
});

describe('secrecy', () => {
	it('public standings carry no Vision data', () => {
		const ws = [wb('a', 'A', 'warlord'), wb('b', 'B', 'legend')];
		const cs = replay(ws, [game('sacred-plains', 'a', 'b', 'a')]);
		const pub = standings(cs, ws, { revealVisions: false, final: false });
		expect(JSON.stringify(pub)).not.toMatch(/vision/i);
		const cm = standings(cs, ws, { revealVisions: true, final: true });
		expect(cm.find((s) => s.id === 'a')).toHaveProperty('visionLevel', 0);
		expect(trackerCvp(cs.players.get('a')!)).toBe(1 + 3);
	});
});

describe('penalty deductions', () => {
	it('takes CVP, Glory and Ducats away, and removes resource boxes without going below empty', () => {
		const events: CampaignEvent[] = [
			{ kind: 'adjustment', id: 'f1', at: 1, warband: 'a', effects: [{ t: 'fill', track: 'F' }, { t: 'fill', track: 'F' }] },
			{
				kind: 'adjustment', id: 'pen', at: 2, warband: 'a',
				effects: [{ t: 'cvp', n: -3 }, { t: 'glory', n: -2 }, { t: 'ducats', n: -50 }, { t: 'unfill', track: 'F' }, { t: 'unfill', track: 'R' }]
			}
		];
		const cs = replay([wb('a', 'A'), wb('b', 'B')], events);
		const p = cs.players.get('a')!;
		expect(p.tracks.F).toBe(1);
		expect(p.tracks.R).toBe(0);
		expect(p.cvp.other).toBe(-3);
		expect(p.gloryPoints).toBe(-2);
		expect(p.ducats).toBe(-50);
	});
});
