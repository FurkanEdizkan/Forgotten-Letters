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
	'transfer'
];
const CM_ONLY: CampaignAction[] = ['delete', 'restore', 'see_deleted', 'co_cms', 'transfer'];

describe('canInCampaign', () => {
	it('lets the CM do everything', () => {
		for (const a of ALL) expect(canInCampaign('cm', 'admin', a)).toBe(true);
	});

	it('lets a co-CM do the daily work but not the CM-only actions (decision 1)', () => {
		for (const a of ALL) expect(canInCampaign('co_cm', 'admin', a)).toBe(!CM_ONLY.includes(a));
	});

	it('lets any Owner restore, see deleted campaigns and hand over the CM role (decisions 4 and 7)', () => {
		for (const a of ALL)
			expect(canInCampaign(null, 'owner', a)).toBe(
				['restore', 'see_deleted', 'transfer'].includes(a)
			);
		expect(canInCampaign('co_cm', 'owner', 'transfer')).toBe(true);
		expect(canInCampaign('co_cm', 'owner', 'delete')).toBe(false);
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
