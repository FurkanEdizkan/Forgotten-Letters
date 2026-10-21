/**
 * The database schema. Each area of the app has its own Postgres schema; step 1 adds `auth`: accounts, sessions,
 * invites, first-owner setup tokens and the audit log. Ids come from Postgres 18's uuidv7() (time-ordered);
 * append-only logs use bigint identity. Names are snake_case in SQL and camelCase in TypeScript.
 */
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgSchema,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

export const auth = pgSchema('auth');

export const role = auth.enum('role', ['owner', 'admin', 'user']);
export const inviteRole = auth.enum('invite_role', ['admin', 'user']);

const id = () =>
	uuid()
		.primaryKey()
		.default(sql`uuidv7()`);
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const users = auth.table(
	'users',
	{
		id: id(),
		/** Lowercase; used only to sign in. */
		username: text().notNull(),
		displayName: text().notNull(),
		passwordHash: text().notNull(),
		role: role().notNull().default('user'),
		mustChangePassword: boolean().notNull().default(false),
		disabledAt: timestamp({ withTimezone: true }),
		anonymisedAt: timestamp({ withTimezone: true }),
		invitedBy: uuid().references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
		version: integer().notNull().default(1),
		lastSignInAt: timestamp({ withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('users_username_key').on(t.username),
		index('users_role_idx').on(t.role),
		index('users_invited_by_idx').on(t.invitedBy),
		check('users_username_form', sql`${t.username} ~ '^[a-z0-9._-]{3,32}$'`),
		check('users_display_name_length', sql`char_length(${t.displayName}) between 1 and 60`)
	]
);

export const sessions = auth.table(
	'sessions',
	{
		/** SHA-256 of the cookie token; the token itself is never stored. */
		idHash: text().primaryKey(),
		userId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** "Remember me": 30 days sliding; otherwise the cookie ends with the browser. */
		remember: boolean().notNull().default(false),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		userAgent: text(),
		ip: text(),
		createdAt: createdAt()
	},
	(t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)]
);

export const invites = auth.table(
	'invites',
	{
		id: id(),
		tokenHash: text().notNull(),
		role: inviteRole().notNull(),
		note: text(),
		createdBy: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		usedAt: timestamp({ withTimezone: true }),
		usedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
		revokedAt: timestamp({ withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('invites_token_key').on(t.tokenHash),
		index('invites_created_by_idx').on(t.createdBy),
		index('invites_open_idx')
			.on(t.expiresAt)
			.where(sql`${t.usedAt} is null and ${t.revokedAt} is null`)
	]
);

export const setupTokens = auth.table(
	'setup_tokens',
	{
		id: id(),
		tokenHash: text().notNull(),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		usedAt: timestamp({ withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('setup_tokens_token_key').on(t.tokenHash)]
);

export const auditLog = auth.table(
	'audit_log',
	{
		id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
		at: timestamp({ withTimezone: true }).notNull().defaultNow(),
		actorId: uuid().references(() => users.id, { onDelete: 'set null' }),
		action: text().notNull(),
		targetType: text(),
		targetId: text(),
		detail: jsonb().$type<Record<string, unknown>>(),
		ip: text(),
		requestId: text()
	},
	(t) => [index('audit_log_at_idx').on(t.at), index('audit_log_actor_at_idx').on(t.actorId, t.at)]
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type Role = (typeof role.enumValues)[number];
