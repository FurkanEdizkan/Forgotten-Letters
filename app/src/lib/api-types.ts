/**
 * JSON API v1 types: the extra input schemas the API needs beyond `schemas/auth.ts`, and the response schemas the
 * OpenAPI document is built from. Pure: no I/O. Dates travel as ISO strings.
 */
import { z } from 'zod';
import { ROLES } from './roles';
import { ACCENTS } from './schemas/settings';
import { CAMPAIGN_ROLES } from './campaign-rights';
import { STAGES } from './campaign-stage';
import { candidatesQuery, houseRule, KINDS, VISIBILITIES } from './schemas/campaigns';

/** The fixed error codes (mirrors ERROR_STATUS in server/errors.ts; this file must stay free of server code). */
export const ERROR_CODES = [
	'invalid',
	'unauthenticated',
	'forbidden',
	'not_found',
	'conflict',
	'rate_limited',
	'internal',
	'unavailable'
] as const;

// ---------------------------------------------------------------- inputs

export const idParam = z.object({ id: z.string().uuid() });
export const tokenParam = z.object({ token: z.string().min(1).max(100) });
export const versionInput = z.object({ version: z.number().int().min(1) });

export const userPatchInput = z
	.object({
		role: z.enum(ROLES).optional(),
		disabled: z.boolean().optional(),
		version: z.number().int().min(1)
	})
	.refine((v) => v.role !== undefined || v.disabled !== undefined, {
		message: 'Send role or disabled.',
		path: ['role']
	});

export const auditQuery = z.object({
	before: z.coerce.number().int().min(1).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	action: z.string().max(64).optional()
});

// ---------------------------------------------------------------- outputs

const time = z.iso.datetime();

export const userOut = z
	.object({
		id: z.string().uuid(),
		username: z.string(),
		displayName: z.string(),
		role: z.enum(ROLES),
		mustChangePassword: z.boolean()
	})
	.meta({ id: 'User' });

export const areaOut = z.object({ path: z.string(), label: z.string() }).meta({ id: 'Area' });

export const userBody = z.object({ user: userOut });
export const meOut = z.object({ user: userOut, areas: z.array(areaOut) });

export const personOut = z
	.object({
		id: z.string().uuid(),
		username: z.string(),
		displayName: z.string(),
		role: z.enum(ROLES),
		disabled: z.boolean(),
		anonymised: z.boolean(),
		mustChangePassword: z.boolean(),
		lastSignInAt: time.nullable(),
		createdAt: time,
		version: z.number().int()
	})
	.meta({ id: 'Person' });

export const personPage = z.object({
	items: z.array(personOut),
	next: z.string().uuid().nullable()
});
export const resetOut = z.object({ person: personOut, temporary: z.string() });

export const inviteOut = z
	.object({
		id: z.string().uuid(),
		role: z.enum(['admin', 'user']),
		note: z.string().nullable(),
		createdBy: z.string().uuid(),
		expiresAt: time,
		createdAt: time
	})
	.meta({ id: 'Invite' });

export const inviteList = z.object({ items: z.array(inviteOut) });
export const inviteCreated = z.object({ invite: inviteOut, link: z.string() });

export const invitePreview = z
	.object({
		state: z.enum(['open', 'used', 'revoked', 'expired']),
		role: z.enum(['admin', 'user']),
		note: z.string().nullable(),
		inviter: z.string(),
		expiresAt: time
	})
	.meta({ id: 'InvitePreview' });

export const auditEntryOut = z
	.object({
		id: z.number().int(),
		at: time,
		actorId: z.string().uuid().nullable(),
		actorName: z.string().nullable(),
		action: z.string(),
		targetType: z.string().nullable(),
		targetId: z.string().nullable(),
		detail: z.record(z.string(), z.unknown()).nullable(),
		ip: z.string().nullable(),
		requestId: z.string().nullable()
	})
	.meta({ id: 'AuditEntry' });

export const auditPage = z.object({
	items: z.array(auditEntryOut),
	next: z.number().int().nullable()
});

export const settingsOut = z
	.object({
		textScale: z.number().int(),
		accent: z.enum(ACCENTS),
		port: z.number().int(),
		portLocked: z.boolean(),
		address: z.string()
	})
	.meta({ id: 'Settings' });

/** After a port change: the address to open; the old port closes a little later. */
export const moveOut = z.object({ moveTo: z.string() });
export const setupState = z.object({ open: z.boolean() });
export const setupDone = z.object({ user: userOut, moveTo: z.string().nullable() });

// ---------------------------------------------------------------- campaigns (step 2)

const campaignRole = z.enum(CAMPAIGN_ROLES);

/** One card on the campaigns page; `myRole` is the caller's rights, `mySeat` whether they hold a seat. */
export const campaignCard = z
	.object({
		id: z.string().uuid(),
		name: z.string(),
		kind: z.enum(KINDS),
		stage: z.enum(STAGES),
		visibility: z.enum(VISIBILITIES),
		seatsTaken: z.number().int(),
		seatsTotal: z.number().int(),
		startsOn: z.iso.date().nullable(),
		endsOn: z.iso.date().nullable(),
		gamesPerPlayer: z.number().int().nullable(),
		cmName: z.string(),
		myRole: campaignRole.nullable(),
		mySeat: z.boolean(),
		myOpenRequest: z.boolean(),
		deletedAt: time.nullable()
	})
	.meta({ id: 'CampaignCard' });

export const campaignPage = z.object({
	items: z.array(campaignCard),
	next: z.string().uuid().nullable()
});

export const memberOut = z
	.object({
		userId: z.string().uuid(),
		displayName: z.string(),
		siteRole: z.enum(ROLES),
		role: campaignRole
	})
	.meta({ id: 'CampaignMember' });

export const campaignOut = z
	.object({
		...campaignCard.shape,
		description: z.string(),
		houseRules: z.array(houseRule),
		/** The core rules version and the expansions on it (Carcass Front campaigns: the Carcass Front folder). */
		rulesSet: z.string(),
		rulesExpansions: z.array(z.string()),
		/** Warbands in this campaign may go beyond their limits (refusals become warnings). */
		allowBeyondLimits: z.boolean(),
		/** The homebrew sets warbands here may be built on. */
		homebrewSets: z.array(z.uuid()),
		members: z.array(memberOut),
		version: z.number().int()
	})
	.meta({ id: 'Campaign' });

export const seatOut = z
	.object({
		id: z.string().uuid(),
		number: z.number().int(),
		name: z.string(),
		player: z.object({ id: z.string().uuid(), displayName: z.string() }).nullable(),
		joinedAt: time.nullable(),
		/** The seat's open link; only the CM and co-CMs see it. `old`: made before links could be copied. */
		link: z
			.object({
				state: z.enum(['ready', 'old']),
				/** The link's last four characters, to tell links apart without showing them. */
				tail: z.string().nullable(),
				createdAt: time,
				openedAt: time.nullable()
			})
			.nullable(),
		version: z.number().int()
	})
	.meta({ id: 'Seat' });

export const seatList = z.object({ items: z.array(seatOut) });

/** A seat link. Null `expiresAt`: valid until someone takes the seat or the link is withdrawn. */
export const seatLinkOut = z
	.object({
		seatId: z.string().uuid(),
		seatName: z.string(),
		url: z.string(),
		expiresAt: time.nullable()
	})
	.meta({ id: 'SeatLink' });

export const seatLinks = z.object({ links: z.array(seatLinkOut) });

export const withdrawnCount = z.object({ withdrawn: z.number().int() });

/** A seat's open link again, to copy. */
export const seatLinkCopy = seatLinkOut.extend({ createdAt: time }).meta({ id: 'SeatLinkCopy' });

const valueField = z.object({
	key: z.string(),
	label: z.string(),
	type: z.enum(['inches', 'number', 'boolean', 'choice']),
	default: z.union([z.number(), z.boolean(), z.string()]),
	min: z.number().optional(),
	max: z.number().optional(),
	unit: z.string().optional(),
	choices: z.array(z.object({ value: z.string(), label: z.string() })).optional()
});
/** The house rule library. */
export const presetList = z.object({
	items: z.array(
		z
			.object({
				key: z.string(),
				kind: z.enum(['passive', 'configuration']),
				name: z.string(),
				summary: z.string(),
				houseOnly: z.boolean().optional(),
				only: z.enum(['carcass_front']).optional(),
				step: z.number().int(),
				fields: z.array(valueField)
			})
			.meta({ id: 'HouseRulePreset' })
	)
});

export const requestOut = z
	.object({
		id: z.string().uuid(),
		person: z.object({ id: z.string().uuid(), displayName: z.string(), username: z.string() }),
		note: z.string(),
		createdAt: time
	})
	.meta({ id: 'JoinRequest' });

export const requestList = z.object({ items: z.array(requestOut) });

export const candidateOut = z
	.object({ id: z.string().uuid(), displayName: z.string(), username: z.string() })
	.meta({ id: 'Candidate' });

export const seatInvitePreview = z
	.object({
		state: z.enum(['open', 'used', 'revoked', 'expired']),
		campaign: z.object({
			id: z.string().uuid(),
			name: z.string(),
			kind: z.enum(KINDS),
			stage: z.enum(STAGES),
			cmName: z.string()
		}),
		seatName: z.string(),
		expiresAt: time.nullable()
	})
	.meta({ id: 'SeatInvitePreview' });

export const seatTaken = z.object({ campaignId: z.string().uuid() });

export const campaignCreated = z.object({ campaign: campaignOut, seats: z.array(seatOut) });
/** GET /campaigns/:id: the campaign, with the caller's rights and the seats taken repeated at the top. */
export const campaignBody = z.object({
	campaign: campaignOut,
	myRole: campaignRole.nullable(),
	seatsTaken: z.number().int()
});
export const memberList = z.object({ members: z.array(memberOut) });
export const candidateList = z.object({ items: z.array(candidateOut) });

export const campaignSeatParam = z.object({ id: z.string().uuid(), seatId: z.string().uuid() });
export const campaignUserParam = z.object({ id: z.string().uuid(), userId: z.string().uuid() });
export const campaignRequestParam = z.object({ id: z.string().uuid(), rid: z.string().uuid() });
/** Who to look for: someone for a seat (add by name) or an Admin or Owner to make co-CM. */
export const candidatesFor = candidatesQuery.extend({
	for: z.enum(['seat', 'co_cm']).default('seat')
});

export type ApiCampaignCard = z.output<typeof campaignCard>;
export type ApiCampaign = z.output<typeof campaignOut>;
export type ApiSeat = z.output<typeof seatOut>;
export type ApiSeatLink = z.output<typeof seatLinkOut>;
export type ApiJoinRequest = z.output<typeof requestOut>;
export type ApiSeatInvitePreview = z.output<typeof seatInvitePreview>;

export const errorOut = z
	.object({
		error: z.object({
			code: z.enum(ERROR_CODES),
			message: z.string(),
			requestId: z.string(),
			fields: z.record(z.string(), z.string()).optional()
		})
	})
	.meta({ id: 'Error' });

export type ApiUser = z.output<typeof userOut>;
export type Me = z.output<typeof meOut>;
export type ApiPerson = z.output<typeof personOut>;
export type ApiInvite = z.output<typeof inviteOut>;
export type ApiAuditEntry = z.output<typeof auditEntryOut>;
export type ApiError = z.output<typeof errorOut>;

/** The public part of a signed-in user (never the session hash). */
export const toUser = (u: ApiUser): ApiUser => ({
	id: u.id,
	username: u.username,
	displayName: u.displayName,
	role: u.role,
	mustChangePassword: u.mustChangePassword
});
