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
import * as t from '#lib/api-types';
import { ERROR_STATUS, type ErrorCode } from '../errors';
import { SESSION_COOKIE } from './index';

type Method = 'get' | 'post' | 'patch' | 'delete';

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
		summary: 'Make a one-time seat link, shown once (CM, co-CMs).',
		auth: true,
		params: t.campaignSeatParam,
		ok: { status: 201, schema: t.seatLinkOut },
		errors: [...WRITE, 'unauthenticated', 'not_found', 'conflict']
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
		summary: 'A fresh link for every empty seat, shown once (CM, co-CMs).',
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
		path: '/openapi.json',
		summary: 'This OpenAPI document.',
		auth: false,
		ok: { status: 200, schema: z.record(z.string(), z.unknown()) },
		errors: []
	}
];

const MESSAGES: Record<ErrorCode, string> = {
	invalid: 'Input failed its schema or a business rule; `fields` holds per-field messages.',
	unauthenticated: 'Not signed in, or the session expired.',
	forbidden: 'Signed in but not allowed, or a cross-site request.',
	not_found: 'No such resource.',
	conflict:
		'Stale version, a used or expired invite, the last owner, setup not done or already done, a port that is locked or in use, a taken name or seat, a stage move not allowed, or joining closed.',
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
