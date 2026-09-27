import { describe, expect, it } from 'vitest';
import { layerParams, normaliseFx, normaliseLayers } from './types';

describe('weather config', () => {
	it('upgrades v1 layers (on/intensity only) with default tuning', () => {
		const fx = normaliseFx({ layers: { rain: { on: true, intensity: 0.7 } }, wind: 0.3 });
		expect(fx.layers.rain).toEqual({ on: true, intensity: 0.7, speed: 1, scale: 1, opacity: 1, tint: null });
		expect(fx.timeOfDay).toBe('day');
		expect(fx.presets).toEqual([]);
		expect(fx.random.kinds.length).toBeGreaterThan(0);
	});

	it('clamps tuning and rejects unknown kinds and bad colours', () => {
		const layers = normaliseLayers({
			fog: { on: true, intensity: 5, speed: 99, scale: 0.1, opacity: -1, tint: '#AbCdEf' },
			lasers: { on: true, intensity: 1 },
			rain: { on: true, intensity: 0.5, tint: 'red' }
		});
		expect(layers.fog).toEqual({ on: true, intensity: 1, speed: 3, scale: 0.5, opacity: 0, tint: '#abcdef' });
		expect(layers).not.toHaveProperty('lasers');
		expect(layers.rain?.tint).toBeNull();
		expect(layerParams(layers.fog).tint).toBe(0xabcdef);
	});

	it('keeps named presets and drops junk', () => {
		const fx = normaliseFx({
			presets: [{ name: ' Red Tide ', layers: { bloodRain: { on: true, intensity: 0.8 } }, wind: 5, timeOfDay: 'blood-moon' }, { name: '' }, null]
		});
		expect(fx.presets).toHaveLength(1);
		expect(fx.presets[0]).toMatchObject({ name: 'Red Tide', wind: 1, timeOfDay: 'blood-moon' });
		expect(normaliseFx({ timeOfDay: 'noon' }).timeOfDay).toBe('day');
	});
});
