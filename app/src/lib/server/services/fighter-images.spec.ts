/** Fighter images are told apart by their first bytes, and read only up to 2 MB. */
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, check, readLimited, sniff } from './fighter-images';

const bytes = (...xs: number[]) => new Uint8Array(xs);
const ascii = (s: string) => new TextEncoder().encode(s);

describe('fighter images', () => {
	it('knows PNG, JPEG and WebP by signature, and nothing else', () => {
		expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
		expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
		expect(sniff(ascii('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('image/webp');
		expect(sniff(ascii('GIF89a'))).toBeNull();
		expect(sniff(ascii('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
		expect(() => check(ascii('RIFF....AVI '))).toThrow(/not a PNG, JPEG or WebP/);
	});
	it('stops reading a stream past 2 MB', async () => {
		const big = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)]);
		await expect(readLimited(big.stream())).rejects.toMatchObject({ code: 'invalid' });
		await expect(readLimited(big)).rejects.toMatchObject({ code: 'invalid' });
		const ok = await readLimited(new Blob([bytes(1, 2, 3)]).stream());
		expect([...ok]).toEqual([1, 2, 3]);
	});
});
