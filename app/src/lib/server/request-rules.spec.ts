import { describe, expect, it } from 'vitest';
import { MAX_PENDING_SIGNUPS, checkSignup } from './request-rules';

const good = { username: 'alric', displayName: 'Alric of Ypres', password: 'trench-mud-1914', confirm: 'trench-mud-1914' };

describe('checkSignup', () => {
	it('accepts a good request and normalises it', () => {
		expect(checkSignup({ ...good, username: '  Alric ', displayName: '  Alric   of  Ypres ' })).toEqual({
			ok: true,
			value: { username: 'alric', displayName: 'Alric of Ypres', email: null, password: 'trench-mud-1914' }
		});
	});
	it('treats a blank display name as none and caps a long one at 40 characters', () => {
		const blank = checkSignup({ ...good, displayName: '   ' });
		expect(blank.ok && blank.value.displayName).toBe(null);
		const long = checkSignup({ ...good, displayName: 'x'.repeat(60) });
		expect(long.ok && long.value.displayName).toBe('x'.repeat(40));
	});
	it('rejects usernames the sign-in form could never accept', () => {
		for (const username of ['', 'a', 'al ric', '-alric', 'x'.repeat(33)]) {
			const r = checkSignup({ ...good, username });
			expect(r.ok, username).toBe(false);
		}
	});
	it('rejects a short password and a mismatched confirmation', () => {
		expect(checkSignup({ ...good, password: 'short', confirm: 'short' })).toEqual({
			ok: false,
			message: 'Passwords need at least 8 characters.'
		});
		expect(checkSignup({ ...good, confirm: 'trench-mud-1915' })).toEqual({
			ok: false,
			message: 'The two passwords do not match.'
		});
	});
	it('caps pending sign-ups at 50', () => {
		expect(MAX_PENDING_SIGNUPS).toBe(50);
	});
	it('keeps an optional email, trimmed and lowercased, and rejects a malformed one', () => {
		const withEmail = checkSignup({ ...good, email: '  Alric@Ypres.Example ' });
		expect(withEmail.ok && withEmail.value.email).toBe('alric@ypres.example');
		const blank = checkSignup({ ...good, email: '   ' });
		expect(blank.ok && blank.value.email).toBe(null);
		for (const email of ['alric', 'alric@', '@ypres.example', 'al ric@ypres.example', 'alric@ypres'])
			expect(checkSignup({ ...good, email }), email).toEqual({ ok: false, message: 'That email address does not look right.' });
	});
});
