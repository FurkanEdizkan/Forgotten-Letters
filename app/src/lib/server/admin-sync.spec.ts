import { describe, expect, it } from 'vitest';
import { adminSyncPlan } from './admin-sync';

const ok = { role: 'cm' as const, disabled: false, mustChangePassword: false, passwordMatches: true };

describe('adminSyncPlan', () => {
	it('creates the admin when the account is missing', () => {
		expect(adminSyncPlan(null)).toEqual({ kind: 'create' });
	});
	it('leaves a matching, enabled Campaign Master alone', () => {
		expect(adminSyncPlan(ok)).toEqual({ kind: 'none' });
	});
	it('re-hashes only when the .env password no longer matches', () => {
		expect(adminSyncPlan({ ...ok, passwordMatches: false })).toEqual({ kind: 'update', fields: {}, rehash: true });
	});
	it('restores role, enables the account and clears a forced password change', () => {
		expect(adminSyncPlan({ role: 'player', disabled: true, mustChangePassword: true, passwordMatches: true })).toEqual({
			kind: 'update',
			fields: { role: 'cm', disabled: false, mustChangePassword: false },
			rehash: false
		});
	});
});
