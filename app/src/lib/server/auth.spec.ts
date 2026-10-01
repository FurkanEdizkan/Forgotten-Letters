import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ db: {} }));
vi.mock('./redis', () => ({ kv: () => ({}) }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

const { needsRenewal, sessionCookie } = await import('./auth');
const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 9, 1);

describe('rolling sessions', () => {
	it('a fresh session is left alone; after a day it slides forward', () => {
		expect(needsRenewal(new Date(now + 30 * DAY), now)).toBe(false);
		expect(needsRenewal(new Date(now + 29.5 * DAY), now)).toBe(false);
		expect(needsRenewal(new Date(now + 28.9 * DAY), now)).toBe(true);
	});

	it('remember me keeps the cookie for the 30 days; otherwise it ends with the browser', () => {
		expect(sessionCookie(true, true)).toMatchObject({ maxAge: 30 * 24 * 60 * 60, httpOnly: true, secure: true, sameSite: 'lax' });
		expect(sessionCookie(false, false)).not.toHaveProperty('maxAge');
	});
});
