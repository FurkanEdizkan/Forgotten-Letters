import { describe, expect, it, vi } from 'vitest';
import { openLink, sealLink } from './link-cipher';

// The key is derived from the database password when LINK_KEY is unset; config is read on first use.
vi.stubEnv('DATABASE_URL', 'postgres://letters:not-a-real-password@db:5432/letters');

describe('link cipher', () => {
	it('round-trips a token, differently each time', () => {
		const a = sealLink('tok-123');
		expect(a).not.toBe(sealLink('tok-123'));
		expect(openLink(a)).toBe('tok-123');
	});

	it('reads anything tampered with, missing or unknown as null', () => {
		const [v, iv, tag, data] = sealLink('tok-123').split('.');
		expect(openLink([v, iv, tag, data!.slice(0, -2) + 'AA'].join('.'))).toBeNull();
		expect(openLink(null)).toBeNull();
		expect(openLink('v0.a.b.c')).toBeNull();
	});
});
