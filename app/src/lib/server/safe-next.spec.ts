import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

const origin = 'https://front.example';

describe('safeNext', () => {
	it('keeps same-site paths, with their query and fragment', () => {
		expect(safeNext('/zones', origin)).toBe('/zones');
		expect(safeNext('/?battle=g1#top', origin)).toBe('/?battle=g1#top');
	});
	it('gives nothing for a missing or relative value', () => {
		expect(safeNext(null, origin)).toBe(null);
		expect(safeNext('', origin)).toBe(null);
		expect(safeNext('zones', origin)).toBe(null);
	});
	it('refuses every way of naming another site', () => {
		for (const next of ['https://evil.invalid/', '//evil.invalid', '/\\evil.invalid', '/\t/evil.invalid', '/\n/evil.invalid'])
			expect(safeNext(next, origin), JSON.stringify(next)).toBe(null);
	});
});
