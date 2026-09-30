import { describe, expect, it } from 'vitest';
import { requestLimiter, requestSignup } from './requests';

const good = { username: 'alric', displayName: '', password: 'trench-mud-1914', confirm: 'trench-mud-1914' };

describe('requestSignup rate limit', () => {
	it('spends nothing on a form that fails its own checks', async () => {
		for (let i = 0; i < 8; i++)
			expect(await requestSignup({ ...good, confirm: 'typo' }, 'ip:typist')).toMatchObject({ ok: false, status: 400 });
		expect(requestLimiter.take('ip:typist')).toBe(true);
	});
	it('refuses a good form over the limit before touching the database', async () => {
		for (let i = 0; i < 5; i++) requestLimiter.take('ip:flooder');
		expect(await requestSignup(good, 'ip:flooder')).toEqual({
			ok: false,
			status: 429,
			message: 'Too many requests from here. Wait a few minutes and try again.'
		});
	});
});
