import { describe, expect, it } from 'vitest';
import {
	DUMMY_HASH,
	hashPassword,
	isCommonPassword,
	needsRehash,
	newToken,
	temporaryPassword,
	tokenHash,
	verifyPassword
} from './passwords';

describe('hashPassword and verifyPassword', () => {
	it('round trips, and refuses a wrong password', async () => {
		const h = await hashPassword('a long passphrase');
		expect(h).toMatch(/^scrypt\$v1\$131072\$8\$1\$[\w-]+\$[\w-]+$/);
		expect(await verifyPassword('a long passphrase', h)).toBe(true);
		expect(await verifyPassword('a long passphrasf', h)).toBe(false);
	});
	it('salts every hash', async () => {
		expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
	});
	it('treats composed and decomposed accents as the same password (NFKC)', async () => {
		const h = await hashPassword('café au lait!');
		expect(await verifyPassword('café au lait!', h)).toBe(true);
	});
	it('never matches the dummy hash', async () => {
		expect(await verifyPassword('', DUMMY_HASH)).toBe(false);
		expect(await verifyPassword('anything at all', DUMMY_HASH)).toBe(false);
	});
	it('returns false for a missing or foreign stored hash', async () => {
		expect(await verifyPassword('x', null)).toBe(false);
		expect(await verifyPassword('x', undefined)).toBe(false);
		expect(await verifyPassword('x', '')).toBe(false);
		expect(await verifyPassword('x', '$2b$10$abcdefghijklmnopqrstuv')).toBe(false);
		expect(await verifyPassword('x', 'scrypt$v1$too$few')).toBe(false);
	});
	it('returns false (does not throw) for a scrypt hash with bad parameters', async () => {
		await expect(verifyPassword('x', 'scrypt$v1$notanumber$8$1$AAAA$AAAA')).resolves.toBe(false);
	});
	it('returns false (does not throw) for a scrypt hash with an empty hash part', async () => {
		await expect(verifyPassword('x', 'scrypt$v1$16384$8$1$AAAA$')).resolves.toBe(false);
	});
});

describe('needsRehash', () => {
	it('is false for today’s settings and true for weaker ones', async () => {
		expect(needsRehash(await hashPassword('fresh password'))).toBe(false);
		expect(needsRehash('scrypt$v1$16384$8$1$AAAA$AAAA')).toBe(true);
		expect(needsRehash('')).toBe(false);
	});
});

describe('tokens', () => {
	it('newToken is 32 random bytes in base64url', () => {
		const tokens = new Set(Array.from({ length: 200 }, newToken));
		expect(tokens.size).toBe(200);
		for (const t of tokens) expect(t).toMatch(/^[\w-]{43}$/);
	});
	it('tokenHash is a stable SHA-256 hex', () => {
		expect(tokenHash('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
		expect(tokenHash('abc')).toBe(tokenHash('abc'));
		expect(tokenHash('abd')).not.toBe(tokenHash('abc'));
	});
});

describe('temporaryPassword', () => {
	it('is three words and four digits, long enough and not common', () => {
		for (let i = 0; i < 100; i++) {
			const p = temporaryPassword();
			expect(p).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[1-9]\d{3}$/);
			expect(p.length).toBeGreaterThanOrEqual(10);
			expect(isCommonPassword(p)).toBe(false);
		}
	});
	it('varies', () => {
		expect(new Set(Array.from({ length: 50 }, temporaryPassword)).size).toBeGreaterThan(40);
	});
});

describe('isCommonPassword', () => {
	it('refuses listed passwords ignoring case', () => {
		expect(isCommonPassword('password123')).toBe(true);
		expect(isCommonPassword('PassWord123')).toBe(true);
		expect(isCommonPassword('TrenchCrusade')).toBe(true);
	});
	it('accepts others', () => {
		expect(isCommonPassword('a quiet grave in the mud')).toBe(false);
	});
});
