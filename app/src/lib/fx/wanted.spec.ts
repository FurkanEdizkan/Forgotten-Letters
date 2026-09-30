import { describe, expect, it } from 'vitest';
import { wantedEffects } from './wanted';
import type { PublicSnapshot } from '$lib/snapshot';
import type { Zone } from '$lib/rules/types';

const zone = { id: 'a', name: 'A zone', type: 'basic', resources: [], links: [] } as unknown as Zone;
const game = (id: string, weatherEvent: number, status: 'in_progress' | 'scheduled' = 'in_progress') => ({ id, zone: 'a', weatherEvent, status });
const snap = (active: ReturnType<typeof game>[]) =>
	({ fx: { layers: {}, battleWeather: true }, regions: [], warbands: [], active }) as unknown as PublicSnapshot;

describe('wantedEffects for battles', () => {
	it("gives each battle on a shared zone its own Hell on Earth, at its own spot", () => {
		// 11 = Raining Blood, 3 = Hemorrhage Eclipse
		const out = wantedEffects(snap([game('g1', 11), game('g2', 3)]), new Map([['a', zone]]), () => ({ x: 1000, y: 1000 }));
		const battle = (id: string) => out.filter((w) => w.key.startsWith(`battle:${id}:`));
		expect(battle('g1').map((w) => w.kind)).toContain('bloodRain');
		expect(battle('g2').map((w) => w.kind)).toContain('eclipse');
		expect(battle('g2').map((w) => w.kind)).not.toContain('bloodRain');
		const spot = (id: string) => {
			const s = battle(id)[0].scope as { x: number; y: number };
			return `${Math.round(s.x)},${Math.round(s.y)}`;
		};
		expect(spot('g1')).not.toBe(spot('g2'));
	});
	it('smokes each battle being fought at its own spot, the watched one hardest', () => {
		const out = wantedEffects(snap([game('g1', 7), game('g2', 7)]), new Map([['a', zone]]), () => ({ x: 0, y: 0 }), 'g2');
		const smoke = out.filter((w) => w.kind === 'battlefield');
		expect(smoke.map((w) => [w.key, w.intensity])).toEqual([
			['battle:g1:battlefield', 0.35],
			['battle:g2:battlefield', 1]
		]);
	});
});

describe('wantedEffects zoomed out', () => {
	it('shows one Hell on Earth per zone, the battle being fought first, merged by place', () => {
		// g1 planned with Raining Blood, g2 being fought with Hemorrhage Eclipse, both on zone a.
		const s = snap([game('g1', 11, 'scheduled'), game('g2', 3)]);
		const out = wantedEffects(s, new Map([['a', zone]]), () => ({ x: 0, y: 0 }), null, false);
		expect(out.some((w) => w.key.startsWith('battle:'))).toBe(false);
		expect(out.map((w) => w.key)).toContain('zone:a:eclipse');
		expect(out.map((w) => w.key)).not.toContain('zone:a:bloodRain');
	});
	it('lets the stronger of a regional and a battle effect of the same kind win at the zone', () => {
		const s = { ...snap([game('g1', 11)]), regions: [{ zones: ['a'], weatherEvent: null, layers: { bloodRain: { on: true, intensity: 0.3 } } }] } as unknown as PublicSnapshot;
		const rain = wantedEffects(s, new Map([['a', zone]]), () => ({ x: 0, y: 0 }), null, false).filter((w) => w.kind === 'bloodRain');
		expect(rain.map((w) => [w.key, w.intensity])).toEqual([['zone:a:bloodRain', 1]]);
	});
});
