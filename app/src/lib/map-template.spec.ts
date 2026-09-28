import { afterEach, describe, expect, it } from 'vitest';
import { parseZones, readZones, toZonesYaml } from './map-template';
import { ALL_ZONES, PRESET_ZONES, buildGraph, setZones } from './rules/zones';

afterEach(() => setZones(PRESET_ZONES));

describe('map zones', () => {
	it('the preset round-trips through YAML', () => {
		const { zones, errors } = parseZones(toZonesYaml(PRESET_ZONES));
		expect(errors).toEqual([]);
		// Positions keep 4 decimals (a tenth of a pixel on a 1000 px map).
		const r = (n: number) => Math.round(n * 10000) / 10000;
		expect(zones).toEqual(PRESET_ZONES.map((z) => (z.pos ? { ...z, pos: { x: r(z.pos.x), y: r(z.pos.y) } } : z)));
	});

	it('reports mistakes by zone and field', () => {
		const { zones, errors } = readZones({
			zones: [
				{ id: 'a', name: 'Gate', type: 'gate', links: ['nowhere'], pos: { x: 2, y: 0 } },
				{ id: 'a', name: 'Twin', type: 'basic', resources: ['X'] }
			]
		});
		expect(zones).toBeNull();
		expect(errors.map((e) => e.path)).toEqual(
			expect.arrayContaining(['zones[0].type', 'zones[0].pos', 'zones[1].id', 'zones[1].resources', 'zones[0].links', 'zones'])
		);
	});

	it('setZones replaces the map for every reader, links both ways', () => {
		setZones([
			{ id: 'A', name: 'Gate', type: 'entry', resources: [], links: ['keep'] },
			{ id: 'keep', name: 'Keep', type: 'special', resources: ['R'], links: [] },
			{ id: 'mire', name: 'Mire', type: 'basic', resources: [], links: ['keep'], house: true }
		]);
		expect(ALL_ZONES.map((z) => z.id)).toEqual(['A', 'keep', 'mire']);
		const g = buildGraph();
		expect([...g.adj.get('keep')!].sort()).toEqual(['A', 'mire']);
		expect(buildGraph(false).zones.has('mire')).toBe(false);
	});
});
