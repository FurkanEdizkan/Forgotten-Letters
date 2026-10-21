import { describe, expect, it } from 'vitest';
import { isCrossSite } from './index';

const req = (method: string, headers: Record<string, string>) =>
	new Request('http://x/', { method, headers });

describe('isCrossSite', () => {
	it('allows reads and same-host writes on any address and scheme', () => {
		expect(isCrossSite(req('GET', { origin: 'https://evil.example', host: 'a' }))).toBe(false);
		expect(
			isCrossSite(req('POST', { origin: 'http://192.168.1.5:3000', host: '192.168.1.5:3000' }))
		).toBe(false);
		expect(
			isCrossSite(req('POST', { origin: 'https://letters.example', host: 'letters.example' }))
		).toBe(false);
	});

	it('refuses writes from another host or port', () => {
		expect(
			isCrossSite(req('POST', { origin: 'https://evil.example', host: 'letters.example' }))
		).toBe(true);
		expect(
			isCrossSite(req('DELETE', { origin: 'http://localhost:4000', host: 'localhost:3000' }))
		).toBe(true);
		expect(isCrossSite(req('POST', { origin: 'null', host: 'localhost:3000' }))).toBe(true);
	});

	it('refuses a form write without Origin but lets scripts through', () => {
		const form = { host: 'a', 'content-type': 'application/x-www-form-urlencoded' };
		expect(isCrossSite(req('POST', form))).toBe(true);
		expect(isCrossSite(req('POST', { host: 'a', 'content-type': 'application/json' }))).toBe(false);
		expect(isCrossSite(req('DELETE', { host: 'a' }))).toBe(false);
	});
});
