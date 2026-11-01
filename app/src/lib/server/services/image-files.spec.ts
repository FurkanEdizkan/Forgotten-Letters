import { describe, expect, it } from 'vitest';
import { pngHeader } from '../testing/png';
import { pngSize, sniff } from './image-files';

describe('pngSize', () => {
	it('reads the width and height from the header chunk', () => {
		expect(pngSize(pngHeader(800, 1000))).toEqual({ width: 800, height: 1000 });
		expect(sniff(pngHeader(1, 1))).toBe('image/png');
	});
	it('is null for anything that is not a whole PNG header', () => {
		expect(pngSize(new Uint8Array([0xff, 0xd8, 0xff, 0, 0]))).toBeNull();
		expect(pngSize(pngHeader(800, 1000).slice(0, 20))).toBeNull();
	});
});
