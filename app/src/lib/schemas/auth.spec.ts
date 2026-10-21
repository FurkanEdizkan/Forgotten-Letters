import { describe, expect, it } from 'vitest';
import {
	changePasswordInput,
	checkbox,
	displayName,
	inviteInput,
	newAccountInput,
	password,
	roleInput,
	signInInput,
	username
} from './auth';

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
	r.error?.issues[0]?.message;

describe('username (F12)', () => {
	it('accepts 3 to 32 letters, digits, dots, dashes and underscores', () => {
		for (const ok of ['abc', 'a.b-c_d', 'x'.repeat(32), 'player1'])
			expect(username.safeParse(ok).success).toBe(true);
	});
	it('lowercases and trims', () => {
		expect(username.parse('  MiXeD.Name ')).toBe('mixed.name');
	});
	it('refuses too short, too long and other characters', () => {
		expect(msg(username.safeParse('ab'))).toBe('Use at least 3 characters.');
		expect(msg(username.safeParse('x'.repeat(33)))).toBe('Use at most 32 characters.');
		for (const bad of ['has space', 'émile', 'a@b', 'semi;colon'])
			expect(msg(username.safeParse(bad))).toBe(
				'Use letters, digits, dots, dashes and underscores only.'
			);
	});
});

describe('password (F14)', () => {
	it('accepts 10 to 128 characters of anything', () => {
		expect(password.safeParse('0123456789').success).toBe(true);
		expect(password.safeParse('ñ'.repeat(128)).success).toBe(true);
		expect(password.safeParse('   spaces   ').success).toBe(true);
	});
	it('refuses 9 and 129 characters', () => {
		expect(msg(password.safeParse('123456789'))).toBe('Use at least 10 characters.');
		expect(msg(password.safeParse('x'.repeat(129)))).toBe('Use at most 128 characters.');
	});
	it('does not trim', () => {
		expect(password.parse(' padded pw ')).toBe(' padded pw ');
	});
});

describe('display name (F13)', () => {
	it('is free text of 1 to 60 characters, trimmed', () => {
		expect(displayName.parse('  Sister Agnès of the Mire  ')).toBe('Sister Agnès of the Mire');
		expect(displayName.safeParse('x'.repeat(60)).success).toBe(true);
	});
	it('refuses blank and too long', () => {
		expect(msg(displayName.safeParse('   '))).toBe('Enter a display name.');
		expect(msg(displayName.safeParse('x'.repeat(61)))).toBe('Use at most 60 characters.');
	});
});

describe('checkbox', () => {
	it('reads forms and JSON alike', () => {
		expect(checkbox.parse('on')).toBe(true);
		expect(checkbox.parse('true')).toBe(true);
		expect(checkbox.parse(true)).toBe(true);
		expect(checkbox.parse('false')).toBe(false);
		expect(checkbox.parse(false)).toBe(false);
		expect(checkbox.parse(undefined)).toBe(false);
	});
	it('refuses anything else', () => {
		expect(checkbox.safeParse('yes').success).toBe(false);
	});
});

describe('input objects', () => {
	it('sign-in needs a username and password; remember defaults to false', () => {
		expect(signInInput.parse({ username: ' Bob ', password: 'x' })).toEqual({
			username: 'Bob',
			password: 'x',
			remember: false
		});
		expect(
			signInInput.safeParse({ username: '', password: '' }).error?.issues.map((i) => i.message)
		).toEqual(['Enter your username.', 'Enter your password.']);
	});
	it('a new account checks all three fields', () => {
		const r = newAccountInput.safeParse({ username: 'a', password: 'short', displayName: '' });
		expect(r.error?.issues.map((i) => i.path[0])).toEqual(['username', 'password', 'displayName']);
	});
	it('a password change needs the current password', () => {
		expect(msg(changePasswordInput.safeParse({ current: '', password: 'long enough pw' }))).toBe(
			'Enter your current password.'
		);
	});
	it('invites fix the role to admin or user, note defaults to empty', () => {
		expect(inviteInput.parse({ role: 'user' })).toEqual({ role: 'user', note: '' });
		expect(inviteInput.safeParse({ role: 'owner' }).success).toBe(false);
	});
	it('role changes carry a version from a form string', () => {
		expect(roleInput.parse({ role: 'admin', version: '3' })).toEqual({ role: 'admin', version: 3 });
		expect(roleInput.safeParse({ role: 'admin', version: '0' }).success).toBe(false);
	});
});
