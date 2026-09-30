import { describe, expect, it } from 'vitest';
import { weatherNow } from './summary';
import { DEFAULT_FX } from './types';

const on = (intensity: number) => ({ on: true, intensity });

describe('weatherNow', () => {
	it('names the time, the running layers in console order with their strength, and the wind', () => {
		const now = weatherNow({ ...DEFAULT_FX, timeOfDay: 'night', wind: 0.4, layers: { fog: on(0.3), rain: on(0.6), storm: { on: false, intensity: 1 } } }, []);
		expect(now).toEqual({ time: 'Night', layers: ['Rain 60%', 'Fog 30%'], wind: 'wind east', regions: [], random: null });
	});
	it('says when the sky is clear and the air still, and when random portents are on', () => {
		const now = weatherNow({ ...DEFAULT_FX, wind: 0, random: { on: true, everySeconds: 45, kinds: ['lightning'] } }, []);
		expect(now.layers).toEqual([]);
		expect(now.wind).toBe('still');
		expect(now.random).toBe('random portents every ~45 s');
	});
	it('lists only active regions, by name or by what they bring', () => {
		const regions = [
			{ name: 'The Front', zones: null, weatherEvent: 3, active: true, layers: {} },
			{ name: null, zones: ['a', 'b'], weatherEvent: null, active: true, layers: { fog: on(0.5) } },
			{ name: 'Lifted', zones: null, weatherEvent: 5, active: false, layers: {} }
		];
		expect(weatherNow(DEFAULT_FX, regions).regions).toEqual(['The Front: Hemorrhage Eclipse (whole map)', 'Fog (2 zones)']);
	});
});
