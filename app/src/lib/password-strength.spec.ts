import { describe, expect, it } from 'vitest';
import { passwordProblem, passwordStrength } from './password-strength';
import { password } from './schemas/auth';

describe('passwordStrength', () => {
	it('rates common, weak, fair, strong and very strong passwords', () => {
		expect(passwordStrength('Password123')).toBe(0);
		expect(passwordStrength('aaaaaaaaaaaaaaaa')).toBe(1);
		expect(passwordStrength('trenchboot')).toBe(2);
		expect(passwordStrength('Trench4boot!')).toBe(3);
		expect(passwordStrength('ember-crow-relic-4821')).toBe(4);
	});

	it('counts runs and repeats as almost nothing', () => {
		expect(passwordStrength('abcdefghijklmnop')).toBe(1);
		expect(passwordStrength('9876543210zyxwvu')).toBe(1);
	});
});

describe('passwordProblem and the password schema', () => {
	it('accepts Strong or better and says why anything else is refused', () => {
		expect(passwordProblem('Trench4boot!')).toBeNull();
		expect(passwordProblem('short')).toMatch(/at least 10/);
		expect(passwordProblem('qwertyuiop')).toMatch(/too common/);
		expect(passwordProblem('trenchboot')).toMatch(/Not strong enough/);
	});

	it('the schema gives the same verdict as the meter', () => {
		expect(password.safeParse('Trench4boot!').success).toBe(true);
		const r = password.safeParse('trenchboot');
		expect(r.success).toBe(false);
		expect(r.error?.issues[0]?.message).toMatch(/Not strong enough/);
	});
});
