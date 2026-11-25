import { describe, expect, it } from 'vitest';
import { canInCampaign, canRunCampaigns, type CampaignAction } from './campaign-rights';

const ALL: CampaignAction[] = [
	'manage',
	'edit',
	'seats',
	'requests',
	'stage',
	'delete',
	'restore',
	'see_deleted',
	'co_cms',
	'transfer',
	'manage_ownership'
];
const CM_ONLY: CampaignAction[] = [
	'delete',
	'restore',
	'see_deleted',
	'co_cms',
	'transfer',
	'manage_ownership'
];

describe('canInCampaign', () => {
	it('lets the CM do everything', () => {
		for (const a of ALL) expect(canInCampaign('cm', 'admin', a)).toBe(true);
	});

	it('lets a co-CM do the daily work but not the CM-only actions (decision 1)', () => {
		for (const a of ALL) expect(canInCampaign('co_cm', 'admin', a)).toBe(!CM_ONLY.includes(a));
	});

	it('lets the site Owner restore, see deleted campaigns, hand over the CM role, delete, open Manage and see the ownership section (decisions 4, 7 and 81)', () => {
		const OWNER_TOO = [
			'restore',
			'see_deleted',
			'transfer',
			'delete',
			'manage',
			'manage_ownership'
		];
		for (const a of ALL) expect(canInCampaign(null, 'owner', a)).toBe(OWNER_TOO.includes(a));
		// Opening Manage gives the Owner no daily work: settings, seats, requests and stage stay with the CM's team.
		for (const a of ['edit', 'seats', 'requests', 'stage', 'co_cms'] as CampaignAction[])
			expect(canInCampaign(null, 'owner', a)).toBe(false);
	});

	it('gives a site Owner who is a co-CM the co-CM rights plus the Owner ones', () => {
		// Only adding and removing co-CMs stays with the CM.
		for (const a of ALL) expect(canInCampaign('co_cm', 'owner', a)).toBe(a !== 'co_cms');
	});

	it('never lets a co-CM delete the campaign or see the ownership section', () => {
		expect(canInCampaign('co_cm', 'admin', 'delete')).toBe(false);
		expect(canInCampaign('co_cm', 'admin', 'manage_ownership')).toBe(false);
		expect(canInCampaign('cm', 'admin', 'manage_ownership')).toBe(true);
	});

	it('gives people without campaign rights nothing, whatever their site role below Owner', () => {
		for (const a of ALL) {
			expect(canInCampaign(null, 'admin', a)).toBe(false);
			expect(canInCampaign(null, 'user', a)).toBe(false);
		}
	});

	it('lets Owners and Admins run campaigns, not Users', () => {
		expect([canRunCampaigns('owner'), canRunCampaigns('admin'), canRunCampaigns('user')]).toEqual([
			true,
			true,
			false
		]);
	});
});
