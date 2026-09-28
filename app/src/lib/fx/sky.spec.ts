import { describe, expect, it } from 'vitest';
import { lightAt } from './sky';

describe('day cycle', () => {
	it('runs day → dusk → night → dawn → day, smoothly and wrapping', () => {
		expect(lightAt(0.2).mul).toBe(0xffffff);
		expect(lightAt(0.5).lamps).toBeCloseTo(0.6);
		expect(lightAt(0.7).lamps).toBe(1);
		expect(lightAt(0.94).lamps).toBeCloseTo(0.35);
		expect(lightAt(1.2)).toEqual(lightAt(0.2));
		// Halfway into dusk is between day and dusk, not a jump.
		const mid = lightAt(0.435).lamps;
		expect(mid).toBeGreaterThan(0.05);
		expect(mid).toBeLessThan(0.55);
	});
});
