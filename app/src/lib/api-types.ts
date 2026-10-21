/**
 * JSON API v1 types: the extra input schemas the API needs beyond `schemas/auth.ts`, and the response schemas the
 * OpenAPI document is built from. Pure: no I/O. Dates travel as ISO strings.
 */
import { z } from 'zod';
import { ROLES } from './roles';

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
