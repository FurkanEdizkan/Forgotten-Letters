import { describe, expect, it } from 'vitest';
import { areasFor, can, homeFor, invitableBy } from './roles';

describe('can', () => {
	it('ranks owner above admin above user', () => {
		expect(can({ role: 'owner' }, 'admin')).toBe(true);
		expect(can({ role: 'owner' }, 'user')).toBe(true);
		expect(can({ role: 'admin' }, 'user')).toBe(true);
		expect(can({ role: 'admin' }, 'owner')).toBe(false);
		expect(can({ role: 'user' }, 'admin')).toBe(false);
	});
	it('lets every role do what its own role may', () => {
		for (const role of ['owner', 'admin', 'user'] as const) expect(can({ role }, role)).toBe(true);
	});
	it('refuses nobody signed in', () => {
		expect(can(null, 'user')).toBe(false);
		expect(can(undefined, 'user')).toBe(false);
	});
});

describe('invitableBy', () => {
	it('owners invite admins and users, admins invite users, users nobody', () => {
		expect(invitableBy('owner')).toEqual(['admin', 'user']);
		expect(invitableBy('admin')).toEqual(['user']);
		expect(invitableBy('user')).toEqual([]);
	});
});

describe('areasFor and homeFor', () => {
	it('lists the areas in header order', () => {
		expect(areasFor('owner').map((a) => a.path)).toEqual(['/owner', '/admin', '/home']);
		expect(areasFor('admin').map((a) => a.path)).toEqual(['/admin', '/home']);
		expect(areasFor('user').map((a) => a.path)).toEqual(['/home']);
	});
	it('calls the admin area Campaign Master', () => {
		expect(areasFor('admin')[0]!.label).toBe('Campaign Master');
	});
	it('lands each role in its own area', () => {
		expect(homeFor('owner')).toBe('/owner');
		expect(homeFor('admin')).toBe('/admin');
		expect(homeFor('user')).toBe('/home');
	});
});
