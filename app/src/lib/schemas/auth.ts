/**
 * Input schemas for accounts and sign-in. Shared by pages, the API and services; the messages are what people see
 * next to a field.
 */
import { z } from 'zod';

export const username = z
	.string()
	.trim()
	.toLowerCase()
	.min(3, 'Use at least 3 characters.')
	.max(32, 'Use at most 32 characters.')
	.regex(/^[a-z0-9._-]+$/, 'Use letters, digits, dots, dashes and underscores only.');

export const password = z
	.string()
	.min(10, 'Use at least 10 characters.')
	.max(128, 'Use at most 128 characters.');

export const displayName = z
	.string()
	.trim()
	.min(1, 'Enter a display name.')
	.max(60, 'Use at most 60 characters.');

/** "on", "true" or a boolean, as forms and JSON send it. */
export const checkbox = z
	.union([z.boolean(), z.literal('on'), z.literal('true'), z.literal('false')])
	.optional()
	.transform((v) => v === true || v === 'on' || v === 'true');

export const signInInput = z.object({
	username: z.string().trim().min(1, 'Enter your username.').max(64),
	password: z.string().min(1, 'Enter your password.').max(256),
	remember: checkbox
});

export const newAccountInput = z.object({ username, password, displayName });

export const changePasswordInput = z.object({
	current: z.string().min(1, 'Enter your current password.').max(256),
	password
});

export const displayNameInput = z.object({ displayName });

export const inviteInput = z.object({
	role: z.enum(['admin', 'user']),
	note: z.string().trim().max(200, 'Use at most 200 characters.').optional().default('')
});

export const roleInput = z.object({
	role: z.enum(['owner', 'admin', 'user']),
	version: z.coerce.number().int().min(1)
});

export const pageQuery = z.object({
	after: z.string().uuid().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});

export type SignInInput = z.infer<typeof signInInput>;
export type NewAccountInput = z.infer<typeof newAccountInput>;
