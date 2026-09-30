import { describe, expect, it } from 'vitest';
import { USERNAME, hashPassword, rateLimiter, temporaryPassword, tokenHash, verifyPassword } from './passwords';
import { memoryKv } from './kv';

describe('passwords', () => {
	it('verifies the right password and rejects the wrong one', async () => {
		const h = await hashPassword('trench-mud-1914');
		expect(h.startsWith('scrypt$')).toBe(true);
		expect(await verifyPassword('trench-mud-1914', h)).toBe(true);
		expect(await verifyPassword('trench-mud-1915', h)).toBe(false);
		expect(await verifyPassword('anything', null)).toBe(false);
		expect(await verifyPassword('anything', 'garbage')).toBe(false);
	});
	it('salts every hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});
	it('hashes tokens deterministically', () => {
		expect(tokenHash('abc')).toBe(tokenHash('abc'));
		expect(tokenHash('abc')).not.toBe(tokenHash('abd'));
	});
	it('makes readable temporary passwords and checks usernames', () => {
		expect(temporaryPassword()).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
		expect(USERNAME.test('alric')).toBe(true);
		expect(USERNAME.test('Al ric')).toBe(false);
	});
});

describe('login rate limit', () => {
	it('allows the limit, blocks the next, resets after the window, and can be cleared', async () => {
		let t = 0;
		const store = memoryKv(() => t);
		const rl = rateLimiter('test', 3, 1000, () => store);
		expect([await rl.take('k'), await rl.take('k'), await rl.take('k')]).toEqual([true, true, true]);
		expect(await rl.take('k')).toBe(false);
		expect(await rl.take('other')).toBe(true);
		t = 1001;
		expect(await rl.take('k')).toBe(true);
		await rl.take('k');
		await rl.take('k');
		await rl.clear('k');
		expect(await rl.take('k')).toBe(true);
	});
});
