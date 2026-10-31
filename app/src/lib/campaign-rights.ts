/**
 * Who may do what inside a campaign (review page decisions 1, 4 and 7). Pure: services enforce it, pages use it to
 * hide what someone cannot do. Rights (CM, co-CM) are kept apart from places (seats): a player is anyone in a seat.
 */
import type { Role } from './roles';

export const CAMPAIGN_ROLES = ['cm', 'co_cm'] as const;
export type CampaignRole = (typeof CAMPAIGN_ROLES)[number];

export type CampaignAction =
	| 'manage' // open the manage page
	| 'edit' // settings and house rules
	| 'seats' // add, rename, free, remove, links, add by name
	| 'requests' // approve and decline
	| 'stage'
	| 'delete'
	| 'restore'
	| 'see_deleted'
	| 'co_cms' // add and remove co-CMs
	| 'transfer'; // hand the CM role to a co-CM

// One person stays answerable for the campaign's existence and its team.
const CM_ONLY: ReadonlySet<CampaignAction> = new Set([
	'delete',
	'restore',
	'see_deleted',
	'co_cms',
	'transfer'
]);
// An Owner can undo a mistaken delete and unstick a campaign whose CM is gone.
const OWNER_TOO: ReadonlySet<CampaignAction> = new Set(['restore', 'see_deleted', 'transfer']);

export function canInCampaign(
	role: CampaignRole | null,
	siteRole: Role,
	action: CampaignAction
): boolean {
	if (role === 'cm') return true;
	if (siteRole === 'owner' && OWNER_TOO.has(action)) return true;
	return role === 'co_cm' && !CM_ONLY.has(action);
}

/** Owners and Admins create campaigns and may hold CM or co-CM rights; Users only play. */
export const canRunCampaigns = (siteRole: Role) => siteRole === 'owner' || siteRole === 'admin';
