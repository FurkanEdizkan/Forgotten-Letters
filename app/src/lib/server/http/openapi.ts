/**
 * The JSON API v1 endpoint registry and the OpenAPI 3.1 document built from it with zod-openapi. One list, so a
 * test can compare it with the route files under `src/routes/api/v1/`.
 */
import { z } from 'zod';
import {
	createDocument,
	type ZodOpenApiOperationObject,
	type ZodOpenApiPathsObject,
	type ZodOpenApiResponseObject
} from 'zod-openapi';
import {
	changePasswordInput,
	displayNameInput,
	inviteInput,
	newAccountInput,
	pageQuery,
	signInInput
} from '#lib/schemas/auth';
import {
	approveInput,
	campaignCreate,
	campaignPatch,
	campaignScopeQuery,
	personInput,
	requestInput,
	seatAcceptInput,
	seatCount,
	seatPatch,
	stageMove
} from '#lib/schemas/campaigns';
import { settingsPatch, setupInput } from '#lib/schemas/settings';
import {
	diffOut,
	diffQuery,
	nodeOut,
	nodePage,
	nodeQuery,
	nodesQuery,
	ruleSetList
} from '#lib/schemas/rules';
import * as w from '#lib/schemas/warbands';
import * as hb from '#lib/schemas/homebrew';
import * as t from '#lib/api-types';
import { ERROR_STATUS, type ErrorCode } from '../errors';
import { SESSION_COOKIE } from './index';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface Endpoint {
	method: Method;
	/** OpenAPI path under /api/v1, with `{param}` segments. */
	path: string;
	summary: string;
	/** false: callable without a session. */
	auth: boolean;
	params?: z.ZodObject;
	query?: z.ZodObject;
	body?: z.ZodType;
	/** The body is a file (raw, or the field `image` of a multipart form), not JSON. */
	upload?: boolean;
	/** Success status and its body schema (none for 204). */
	ok: { status: 200 | 201 | 204; schema?: z.ZodType; cookie?: boolean };
	/** Another success answer, for example 202 when a port change moves the app. */
	alsoOk?: { status: 202; schema: z.ZodType; description: string };
	errors: ErrorCode[];
}

const WRITE: ErrorCode[] = ['invalid', 'forbidden'];

export const ENDPOINTS: Endpoint[] = [
	{
		method: 'post',
		path: '/auth/login',
		summary: 'Sign in with username and password.',
		auth: false,
		body: signInInput,
		ok: { status: 200, schema: t.userBody, cookie: true },
		errors: [...WRITE, 'unauthenticated', 'rate_limited']
	},
	{
		method: 'post',
		path: '/auth/logout',
		summary: 'Sign out on this device.',
		auth: true,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated']
	},
	{
		method: 'post',
		path: '/auth/logout-everywhere',
		summary: 'Sign out every other device.',
		auth: true,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated']
	},
	{
		method: 'get',
		path: '/me',
		summary: 'The signed-in account and the areas it may use.',
		auth: true,
		ok: { status: 200, schema: t.meOut },
		errors: ['unauthenticated']
	},
	{
		method: 'patch',
		path: '/me',
		summary: 'Change the display name.',
		auth: true,
		body: displayNameInput,
		ok: { status: 200, schema: t.userBody },
		errors: [...WRITE, 'unauthenticated']
	},
	{
		method: 'post',
		path: '/me/password',
		summary: 'Change the password; other devices are signed out.',
		auth: true,
		body: changePasswordInput,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated']
	},
	{
		method: 'get',
		path: '/users',
		summary: 'A page of people: all for owners, own invitees for admins.',
		auth: true,
		query: pageQuery,
		ok: { status: 200, schema: t.personPage },
		errors: ['invalid', 'unauthenticated', 'forbidden']
	},
	{
		method: 'patch',
		path: '/users/{id}',
		summary: 'Change role and/or disable or enable an account.',
		auth: true,
		params: t.idParam,
		body: t.userPatchInput,
		ok: { status: 200, schema: t.personOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/users/{id}/reset-password',
		summary: 'Set a temporary password, shown once.',
		auth: true,
		params: t.idParam,
		body: t.versionInput,
		ok: { status: 200, schema: t.resetOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/users/{id}/anonymise',
		summary: 'Anonymise a disabled account.',
		auth: true,
		params: t.idParam,
		body: t.versionInput,
		ok: { status: 200, schema: t.personOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/invites',
		summary: 'Pending invites: all for owners, own for admins.',
		auth: true,
		ok: { status: 200, schema: t.inviteList },
		errors: ['unauthenticated', 'forbidden']
	},
	{
		method: 'post',
		path: '/invites',
		summary: 'Create an invite link.',
		auth: true,
		body: inviteInput,
		ok: { status: 201, schema: t.inviteCreated },
		errors: [...WRITE, 'unauthenticated']
	},
	{
		method: 'delete',
		path: '/invites/{id}',
		summary: 'Withdraw an invite.',
		auth: true,
		params: t.idParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/invites/{id}/resend',
		summary: 'Replace an invite with a fresh link.',
		auth: true,
		params: t.idParam,
		ok: { status: 201, schema: t.inviteCreated },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/invites/token/{token}',
		summary: 'What an invite link offers.',
		auth: false,
		params: t.tokenParam,
		ok: { status: 200, schema: t.invitePreview },
		errors: ['invalid', 'not_found']
	},
	{
		method: 'post',
		path: '/invites/token/{token}/accept',
		summary: 'Accept an invite: create the account and sign in.',
		auth: false,
		params: t.tokenParam,
		body: newAccountInput,
		ok: { status: 201, schema: t.userBody, cookie: true },
		errors: [...WRITE, 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/setup',
		summary: 'Whether first-run setup is open (no owner yet).',
		auth: false,
		ok: { status: 200, schema: t.setupState },
		errors: []
	},
	{
		method: 'post',
		path: '/setup',
		summary: 'Finish first-run setup: create the owner, save the look and port, sign in.',
		auth: false,
		body: setupInput,
		ok: { status: 201, schema: t.setupDone, cookie: true },
		errors: [...WRITE, 'conflict', 'rate_limited']
	},
	{
		method: 'get',
		path: '/settings',
		summary: 'The copy-wide settings: text size, accent, port and address.',
		auth: true,
		ok: { status: 200, schema: t.settingsOut },
		errors: ['unauthenticated']
	},
	{
		method: 'patch',
		path: '/settings',
		summary: 'Change text size, accent or port (owners).',
		auth: true,
		body: settingsPatch,
		ok: { status: 200, schema: t.settingsOut },
		alsoOk: {
			status: 202,
			schema: t.moveOut,
			description: 'The port changed: open `moveTo`; the old port closes shortly.'
		},
		errors: [...WRITE, 'unauthenticated', 'conflict']
	},
	{
		method: 'get',
		path: '/audit',
		summary: 'The audit log, newest first.',
		auth: true,
		query: t.auditQuery,
		ok: { status: 200, schema: t.auditPage },
		errors: ['invalid', 'unauthenticated', 'forbidden']
	},
	{
		method: 'get',
		path: '/campaigns',
		summary: 'A page of campaign cards: mine, listed or deleted.',
		auth: true,
		query: campaignScopeQuery,
		ok: { status: 200, schema: t.campaignPage },
		errors: ['invalid', 'unauthenticated']
	},
	{
		method: 'post',
		path: '/campaigns',
		summary: 'Create a campaign with its seats (Owners and Admins).',
		auth: true,
		body: campaignCreate,
		ok: { status: 201, schema: t.campaignCreated },
		errors: [...WRITE, 'unauthenticated', 'conflict']
	},
	{
		method: 'get',
		path: '/campaigns/{id}',
		summary: 'One campaign (ETag: its version).',
		auth: true,
		params: t.idParam,
		ok: { status: 200, schema: t.campaignBody },
		errors: ['invalid', 'unauthenticated', 'not_found']
	},
	{
		method: 'patch',
		path: '/campaigns/{id}',
		summary: 'Change settings and house rules (CM, co-CMs).',
		auth: true,
		params: t.idParam,
		body: campaignPatch,
		ok: { status: 200, schema: t.campaignOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}',
		summary: 'Delete a campaign; restorable for 30 days (CM).',
		auth: true,
		params: t.idParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/restore',
		summary: 'Restore a deleted campaign (CM, Owners).',
		auth: true,
		params: t.idParam,
		ok: { status: 200, schema: t.campaignOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/stage',
		summary: 'Move to another stage (CM, co-CMs).',
		auth: true,
		params: t.idParam,
		body: stageMove,
		ok: { status: 200, schema: t.campaignOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/campaigns/{id}/seats',
		summary: 'The seats; outsiders see no players.',
		auth: true,
		params: t.idParam,
		ok: { status: 200, schema: t.seatList },
		errors: ['invalid', 'unauthenticated', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/seats',
		summary: 'Add seats, 30 at most (CM, co-CMs).',
		auth: true,
		params: t.idParam,
		body: seatCount,
		ok: { status: 201, schema: t.seatList },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'patch',
		path: '/campaigns/{id}/seats/{seatId}',
		summary: 'Rename or free a seat (CM, co-CMs).',
		auth: true,
		params: t.campaignSeatParam,
		body: seatPatch,
		ok: { status: 200, schema: t.seatOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}/seats/{seatId}',
		summary: 'Remove an empty seat (CM, co-CMs).',
		auth: true,
		params: t.campaignSeatParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/seats/{seatId}/invite',
		summary:
			'Make a lasting seat link: valid until the seat is taken or the link withdrawn (CM, co-CMs).',
		auth: true,
		params: t.campaignSeatParam,
		ok: { status: 201, schema: t.seatLinkOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/campaigns/{id}/seats/{seatId}/invite',
		summary:
			"The seat's open link again, to copy (CM, co-CMs). 409 for a link made before links could be copied.",
		auth: true,
		params: t.campaignSeatParam,
		ok: { status: 200, schema: t.seatLinkCopy },
		errors: ['invalid', 'unauthenticated', 'forbidden', 'not_found', 'conflict']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}/seat-links',
		summary: 'Withdraw every open seat link of the campaign (CM, co-CMs).',
		auth: true,
		params: t.idParam,
		ok: { status: 200, schema: t.withdrawnCount },
		errors: [...WRITE, 'unauthenticated', 'not_found']
	},
	{
		method: 'get',
		path: '/house-rule-presets',
		summary:
			'The house rule library: presets with their kind, value fields and the step that uses them.',
		auth: true,
		ok: { status: 200, schema: t.presetList },
		errors: ['unauthenticated']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}/seats/{seatId}/invite',
		summary: "Withdraw the seat's open link (CM, co-CMs).",
		auth: true,
		params: t.campaignSeatParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/seats/{seatId}/assign',
		summary: 'Add a person by name to an empty seat (CM, co-CMs).',
		auth: true,
		params: t.campaignSeatParam,
		body: personInput,
		ok: { status: 200, schema: t.seatOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}/seats/mine',
		summary: "Leave one's own seat (mustering only).",
		auth: true,
		params: t.idParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/seat-links',
		summary: 'A fresh link for every empty seat (CM, co-CMs).',
		auth: true,
		params: t.idParam,
		ok: { status: 201, schema: t.seatLinks },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/campaigns/{id}/candidates',
		summary: 'People to add to a seat or make co-CM, up to 10.',
		auth: true,
		params: t.idParam,
		query: t.candidatesFor,
		ok: { status: 200, schema: t.candidateList },
		errors: ['invalid', 'unauthenticated', 'forbidden', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/co-cms',
		summary: 'Give an Admin or Owner co-CM rights (CM).',
		auth: true,
		params: t.idParam,
		body: personInput,
		ok: { status: 200, schema: t.memberList },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}/co-cms/{userId}',
		summary: 'Take co-CM rights away (CM).',
		auth: true,
		params: t.campaignUserParam,
		ok: { status: 200, schema: t.memberList },
		errors: [...WRITE, 'unauthenticated', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/transfer',
		summary: 'Hand the CM role to a co-CM (CM, Owners).',
		auth: true,
		params: t.idParam,
		body: personInput,
		ok: { status: 200, schema: t.memberList },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/campaigns/{id}/requests',
		summary: 'Open requests to join (CM, co-CMs).',
		auth: true,
		params: t.idParam,
		ok: { status: 200, schema: t.requestList },
		errors: ['invalid', 'unauthenticated', 'forbidden', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/requests',
		summary: 'Ask to join a listed campaign while it musters.',
		auth: true,
		params: t.idParam,
		body: requestInput,
		ok: { status: 201, schema: t.requestOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'delete',
		path: '/campaigns/{id}/requests/mine',
		summary: "Withdraw one's own open request.",
		auth: true,
		params: t.idParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/requests/{rid}/approve',
		summary: 'Approve a request into an empty seat (CM, co-CMs).',
		auth: true,
		params: t.campaignRequestParam,
		body: approveInput,
		ok: { status: 200, schema: t.seatOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'post',
		path: '/campaigns/{id}/requests/{rid}/decline',
		summary: 'Decline a request (CM, co-CMs).',
		auth: true,
		params: t.campaignRequestParam,
		ok: { status: 204 },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
	},
	{
		method: 'get',
		path: '/seat-invites/{token}',
		summary: 'What a seat link offers.',
		auth: false,
		params: t.tokenParam,
		ok: { status: 200, schema: t.seatInvitePreview },
		errors: ['invalid', 'not_found']
	},
	{
		method: 'post',
		path: '/seat-invites/{token}/accept',
		summary: 'Take the seat: signed in, or with a new account (signed in).',
		auth: false,
		params: t.tokenParam,
		body: seatAcceptInput,
		ok: { status: 201, schema: t.seatTaken, cookie: true },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict', 'rate_limited']
	},
	{
		method: 'get',
		path: '/rules/sets',
		summary: 'Every rules folder, loaded or not, with its report and element counts.',
		auth: true,
		ok: { status: 200, schema: ruleSetList },
		errors: ['unauthenticated']
	},
	{
		method: 'post',
		path: '/rules/sets/reload',
		summary: 'Read the rules folders again and replace the cache (owners).',
		auth: true,
		ok: { status: 200, schema: ruleSetList },
		errors: ['unauthenticated', 'forbidden']
	},
	{
		method: 'get',
		path: '/rules/nodes',
		summary: 'Elements of a set (and its base) whose name contains q.',
		auth: true,
		query: nodesQuery,
		ok: { status: 200, schema: nodePage },
		errors: ['invalid', 'unauthenticated', 'not_found']
	},
	{
		method: 'get',
		path: '/rules/node',
		summary:
			'One element with its links in and out and its neighbourhood graph (id as a query parameter).',
		auth: true,
		query: nodeQuery,
		ok: { status: 200, schema: nodeOut },
		errors: ['invalid', 'unauthenticated', 'not_found']
	},
	{
		method: 'get',
		path: '/rules/diff',
		summary: 'What changed between two rules versions.',
		auth: true,
		query: diffQuery,
		ok: { status: 200, schema: diffOut },
		errors: ['invalid', 'unauthenticated', 'not_found']
	},
	...warbandEndpoints(),
	...homebrewEndpoints(),
	{
		method: 'get',
		path: '/openapi.json',
		summary: 'This OpenAPI document.',
		auth: false,
		ok: { status: 200, schema: z.record(z.string(), z.unknown()) },
		errors: []
	}
];

/** The warband endpoints (steps 3-4): the builder's actions, and a seat's warband. */
function warbandEndpoints(): Endpoint[] {
	const id = z.object({ id: z.uuid() });
	const fighter = w.fighterParams;
	const read: ErrorCode[] = ['invalid', 'unauthenticated', 'not_found'];
	const change: ErrorCode[] = [...WRITE, 'unauthenticated', 'not_found', 'conflict'];
	const one = (
		method: Method,
		path: string,
		summary: string,
		more: Partial<Endpoint> = {}
	): Endpoint => ({
		method,
		path,
		summary,
		auth: true,
		ok: { status: 200, schema: w.warbandOut },
		errors: method === 'get' ? read : change,
		...more
	});
	return [
		one('get', '/warbands', 'My warbands, with rating, problems and seat.', {
			ok: { status: 200, schema: w.warbandList },
			errors: ['unauthenticated']
		}),
		one('post', '/warbands', 'Create a warband (from a seat: the campaign’s rules and seat).', {
			body: w.warbandCreate,
			ok: { status: 201, schema: w.warbandOut }
		}),
		one(
			'get',
			'/warbands/choices',
			'The loaded rules, factions, variants and Patrons to build from.',
			{
				query: w.choicesQuery,
				ok: { status: 200, schema: w.choicesOut }
			}
		),
		one('post', '/warbands/import', 'Import a Trench Companion text export as a new warband.', {
			body: w.warbandImport,
			ok: { status: 201, schema: w.importOut }
		}),
		one(
			'get',
			'/warbands/{id}',
			'One warband (owner; its campaign’s CM read-only), with an ETag.',
			{
				params: id,
				errors: [...read, 'conflict']
			}
		),
		one('patch', '/warbands/{id}', 'Change name, Patron, dedication, limit, banks or notes.', {
			params: id,
			body: w.warbandPatch
		}),
		one('delete', '/warbands/{id}', 'Delete a warband for good.', {
			params: id,
			ok: { status: 204 },
			errors: [...WRITE, 'unauthenticated', 'not_found']
		}),
		one('get', '/warbands/{id}/export', 'Trench Companion text or our JSON, as a file.', {
			params: id,
			query: w.exportQuery,
			ok: { status: 200, schema: z.string() }
		}),
		one('get', '/warbands/{id}/recruits', 'What the warband could recruit, and why not.', {
			params: id,
			ok: { status: 200, schema: w.recruitsOut }
		}),
		one('post', '/warbands/{id}/fighters', 'Recruit an entry, paid from the banks.', {
			params: id,
			body: w.recruitInput,
			ok: { status: 201, schema: w.warbandOut }
		}),
		one(
			'patch',
			'/warbands/{id}/fighters/{fid}',
			'Edit a fighter (name, group, XP, skills, injuries).',
			{
				params: fighter,
				body: w.fighterPatch
			}
		),
		one('delete', '/warbands/{id}/fighters/{fid}', 'Remove a fighter; its worth goes back.', {
			params: fighter
		}),
		one('get', '/warbands/{id}/fighters/{fid}/kit', 'The armoury for this fighter, and why not.', {
			params: fighter,
			ok: { status: 200, schema: w.armouryOut }
		}),
		one('post', '/warbands/{id}/fighters/{fid}/kit', 'Buy kit for a fighter.', {
			params: fighter,
			body: w.lineInput
		}),
		one('delete', '/warbands/{id}/fighters/{fid}/kit', 'Sell one piece of a fighter’s kit.', {
			params: fighter,
			query: w.lineQuery
		}),
		one('get', '/warbands/{id}/fighters/{fid}/upgrades', 'The upgrades a fighter may take.', {
			params: fighter,
			ok: { status: 200, schema: w.upgradesOut }
		}),
		one('post', '/warbands/{id}/fighters/{fid}/upgrades', 'Give a fighter an upgrade.', {
			params: fighter,
			body: w.upgradeInput
		}),
		one('delete', '/warbands/{id}/fighters/{fid}/upgrades', 'Take an upgrade off a fighter.', {
			params: fighter,
			query: w.upgradeQuery
		}),
		one(
			'put',
			'/warbands/{id}/fighters/{fid}/image',
			'Upload a fighter image (PNG, JPEG, WebP, 2 MB).',
			{
				params: fighter,
				upload: true,
				errors: [...WRITE, 'unauthenticated', 'not_found']
			}
		),
		one('delete', '/warbands/{id}/fighters/{fid}/image', 'Remove a fighter’s image.', {
			params: fighter,
			errors: [...WRITE, 'unauthenticated', 'not_found']
		}),
		one('get', '/warbands/{id}/stash', 'What may be bought into the stash.', {
			params: id,
			ok: { status: 200, schema: w.armouryOut }
		}),
		one('post', '/warbands/{id}/stash', 'Buy kit into the stash.', {
			params: id,
			body: w.lineInput
		}),
		one('delete', '/warbands/{id}/stash', 'Sell one piece from the stash.', {
			params: id,
			query: w.lineQuery
		}),
		one('post', '/warbands/{id}/stash/give', 'Give a piece from the stash to a fighter.', {
			params: id,
			body: w.giveInput
		}),
		one('put', '/warbands/{id}/fireteams', 'Replace the fireteams.', {
			params: id,
			body: w.fireteamsInput
		}),
		one('put', '/warbands/{id}/locations', 'Replace the locations.', {
			params: id,
			body: w.locationsInput,
			errors: [...WRITE, 'unauthenticated', 'not_found']
		}),
		one('put', '/campaigns/{id}/seats/mine/warband', 'Put one of my warbands in my seat.', {
			params: id,
			body: w.assignInput
		}),
		one('delete', '/campaigns/{id}/seats/mine/warband', 'Take my warband out of my seat.', {
			params: id,
			ok: { status: 204 }
		}),
		one('get', '/campaigns/{id}/warbands', 'Every seat’s warband (CM, co-CMs).', {
			params: id,
			ok: { status: 200, schema: w.campaignWarbandsOut },
			errors: [...read, 'forbidden']
		})
	];
}

/** The homebrew endpoints (steps 3-4): player-made rules sets. A campaign's allow-list is its PATCH's `homebrewSets`. */
function homebrewEndpoints(): Endpoint[] {
	const params = hb.homebrewParams;
	const read: ErrorCode[] = ['invalid', 'unauthenticated', 'not_found'];
	const change: ErrorCode[] = [...WRITE, 'unauthenticated', 'not_found', 'conflict'];
	const one = (method: Method, path: string, summary: string, more: Partial<Endpoint> = {}) =>
		({
			method,
			path,
			summary,
			auth: true,
			ok: { status: 200, schema: hb.homebrewOut },
			errors: method === 'get' ? read : change,
			...more
		}) as Endpoint;
	return [
		one('get', '/homebrew', 'My homebrew sets and the shared ones.', {
			ok: { status: 200, schema: hb.homebrewList },
			errors: ['unauthenticated']
		}),
		one('post', '/homebrew', 'Make a homebrew set: blank faction, variant, items, or a copy.', {
			body: hb.homebrewCreate,
			ok: { status: 201, schema: hb.homebrewOut },
			errors: [...WRITE, 'unauthenticated', 'not_found']
		}),
		one(
			'post',
			'/homebrew/import',
			'Import an exported homebrew set (refused if it fails its checks).',
			{
				body: hb.homebrewImport,
				ok: { status: 201, schema: hb.homebrewOut },
				errors: [...WRITE, 'unauthenticated', 'not_found']
			}
		),
		one('get', '/homebrew/{id}', 'One homebrew set with its data and check report, with an ETag.', {
			params
		}),
		one('put', '/homebrew/{id}', 'Save the whole set (version check); checked and re-indexed.', {
			params,
			body: hb.homebrewUpdate
		}),
		one('delete', '/homebrew/{id}', 'Delete a homebrew set (refused while in use).', {
			params,
			ok: { status: 204 }
		}),
		one('post', '/homebrew/{id}/share', 'Share the set with everyone on this install.', { params }),
		one(
			'delete',
			'/homebrew/{id}/share',
			'Make the set private again (refused while others use it).',
			{
				params
			}
		),
		one('get', '/homebrew/{id}/export', 'The set as one JSON object of its folder files.', {
			params,
			ok: { status: 200, schema: z.record(z.string(), z.unknown()) }
		})
	];
}

const MESSAGES: Record<ErrorCode, string> = {
	invalid: 'Input failed its schema or a business rule; `fields` holds per-field messages.',
	unauthenticated: 'Not signed in, or the session expired.',
	forbidden: 'Signed in but not allowed, or a cross-site request.',
	not_found: 'No such resource.',
	conflict:
		'Stale version, a used or expired invite, the last owner, setup not done or already done, a port that is locked or in use, a taken name or seat, a stage move not allowed, joining closed, a warband change the rules refuse (the reasons are in the message and `fields`), homebrew a campaign does not allow, or a homebrew set others still use.',
	rate_limited: 'Too many tries; see Retry-After.',
	internal: 'Unexpected error; quote the request id.',
	unavailable: 'Starting or shutting down; see Retry-After.'
};

const errorResponse = (codes: ErrorCode[]) => ({
	description: codes.map((c) => `\`${c}\`: ${MESSAGES[c]}`).join(' '),
	content: { 'application/json': { schema: t.errorOut } }
});

function operation(e: Endpoint): ZodOpenApiOperationObject {
	const responses: Record<string, ZodOpenApiResponseObject> = {
		[e.ok.status]: {
			description: e.ok.cookie ? 'Success; sets the session cookie.' : 'Success.',
			...(e.ok.schema ? { content: { 'application/json': { schema: e.ok.schema } } } : {})
		}
	};
	if (e.alsoOk)
		responses[e.alsoOk.status] = {
			description: e.alsoOk.description,
			content: { 'application/json': { schema: e.alsoOk.schema } }
		};
	// Every endpoint can also answer internal (500) and unavailable (503).
	const byStatus = new Map<number, ErrorCode[]>();
	for (const c of [...e.errors, 'internal', 'unavailable'] as ErrorCode[])
		byStatus.set(ERROR_STATUS[c], [...(byStatus.get(ERROR_STATUS[c]) ?? []), c]);
	for (const [status, codes] of byStatus) responses[status] = errorResponse(codes);
	return {
		summary: e.summary,
		security: e.auth ? [{ session: [] }] : [],
		...(e.params || e.query
			? {
					requestParams: {
						...(e.params ? { path: e.params } : {}),
						...(e.query ? { query: e.query } : {})
					}
				}
			: {}),
		...(e.body
			? { requestBody: { required: true, content: { 'application/json': { schema: e.body } } } }
			: {}),
		...(e.upload
			? {
					requestBody: {
						required: true,
						content: Object.fromEntries(
							['image/png', 'image/jpeg', 'image/webp', 'multipart/form-data'].map((type) => [
								type,
								{ schema: z.string().meta({ format: 'binary' }) }
							])
						)
					}
				}
			: {}),
		responses
	};
}

let doc: ReturnType<typeof createDocument> | undefined;

/** The OpenAPI 3.1 document (built once). */
export function openApiDocument() {
	if (doc) return doc;
	const paths: ZodOpenApiPathsObject = {};
	for (const e of ENDPOINTS) paths[e.path] = { ...paths[e.path], [e.method]: operation(e) };
	doc = createDocument({
		openapi: '3.1.0',
		info: {
			title: 'Forgotten Letters API',
			version: '1',
			description:
				'The same actions as the pages, authenticated by the session cookie. Writes must send JSON from this site (matching Origin).'
		},
		servers: [{ url: '/api/v1' }],
		components: {
			securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE } }
		},
		security: [{ session: [] }],
		paths
	});
	return doc;
}
