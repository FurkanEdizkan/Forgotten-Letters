/**
 * The database schema. Each area of the app has its own Postgres schema: `auth` holds accounts, sessions, invites
 * and the audit log; `app` holds the copy-wide settings; `campaign` holds campaigns, their rights (members), places
 * (seats), seat links and join requests; `rules` caches the loaded rules folders (sets, their elements as nodes and
 * the links between them as edges); `warband` holds players' warbands and their fighters; `homebrew` holds player-made
 * rules sets. Ids come from Postgres 18's uuidv7() (time-ordered);
 * append-only logs use bigint identity. Names are snake_case in SQL and camelCase in TypeScript.
 */
import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgSchema,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { ACCENTS, PORT, TEXT_SCALE } from '../../schemas/settings';
import type { HouseRule } from '../../schemas/campaigns';
import type { Problem } from '../../rules/check';
import { EDGE_KINDS } from '../../rules/pack';
import { GROUPS } from '../../warbands/types';

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

export const appSchema = pgSchema('app');

const accentList = sql.raw(ACCENTS.map((a) => `'${a}'`).join(', '));

/**
 * The copy-wide settings: exactly one row (id 1), made by the migration. The checks repeat the zod rules in
 * `schemas/settings.ts`, so a bad value cannot be stored even by hand. `setup_completed_at` is null until the first
 * owner finishes the setup wizard.
 */
export const settings = appSchema.table(
	'settings',
	{
		id: smallint().primaryKey().default(1),
		textScale: smallint().notNull().default(TEXT_SCALE.default),
		accent: text().notNull().default('blood'),
		port: integer().notNull().default(PORT.default),
		setupCompletedAt: timestamp({ withTimezone: true }),
		updatedAt: updatedAt(),
		updatedBy: uuid().references(() => users.id, { onDelete: 'set null' })
	},
	(t) => [
		check('settings_single_row', sql`${t.id} = 1`),
		check(
			'settings_text_scale_range',
			sql`${t.textScale} between ${sql.raw(String(TEXT_SCALE.min))} and ${sql.raw(String(TEXT_SCALE.max))} and ${t.textScale} % ${sql.raw(String(TEXT_SCALE.step))} = 0`
		),
		check('settings_accent_preset', sql`${t.accent} in (${accentList})`),
		check(
			'settings_port_range',
			sql`${t.port} between ${sql.raw(String(PORT.min))} and ${sql.raw(String(PORT.max))}`
		)
	]
);

export const campaignSchema = pgSchema('campaign');

export const kind = campaignSchema.enum('kind', ['carcass_front', 'generic']);
export const stage = campaignSchema.enum('stage', ['mustering', 'active', 'ended']);
export const visibility = campaignSchema.enum('visibility', ['listed', 'private']);
export const memberRole = campaignSchema.enum('member_role', ['cm', 'co_cm']);
export const requestStatus = campaignSchema.enum('request_status', [
	'open',
	'approved',
	'declined',
	'withdrawn'
]);

/**
 * A campaign. Names are unique ignoring case among campaigns not deleted, so a deleted campaign's name is free again
 * (restoring re-checks it). Soft delete: `deleted_at` is set, and the daily purge removes the row 30 days later; every
 * child table cascades from here.
 */
export const campaigns = campaignSchema.table(
	'campaigns',
	{
		id: id(),
		name: text().notNull(),
		kind: kind().notNull(),
		description: text().notNull().default(''),
		stage: stage().notNull().default('mustering'),
		visibility: visibility().notNull(),
		gamesPerPlayer: smallint(),
		startsOn: date(),
		endsOn: date(),
		houseRules: jsonb().$type<HouseRule[]>().notNull().default([]),
		/** The rules folder (core version) the campaign plays; no foreign key, since a reload rebuilds the cache. */
		rulesSet: text().notNull().default('core-1.0.2'),
		/** Expansion folders on top of it (Carcass Front campaigns: carcass-front-1.0). */
		rulesExpansions: text()
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		/** The CM lets warbands in this campaign go beyond their limits: refusals become warnings. */
		allowBeyondLimits: boolean().notNull().default(false),
		/** Homebrew sets (homebrew.homebrew_sets ids) the CM allows; no foreign key on an array, so deletes tidy it. */
		homebrewSets: uuid()
			.array()
			.notNull()
			.default(sql`'{}'::uuid[]`),
		createdBy: uuid()
			.notNull()
			.references(() => users.id),
		version: integer().notNull().default(1),
		deletedAt: timestamp({ withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('campaigns_name_key')
			.on(sql`lower(${t.name})`)
			.where(sql`${t.deletedAt} is null`),
		index('campaigns_deleted_idx')
			.on(t.deletedAt)
			.where(sql`${t.deletedAt} is not null`),
		check('campaigns_name_length', sql`char_length(${t.name}) between 1 and 80`),
		check('campaigns_description_length', sql`char_length(${t.description}) <= 500`),
		check('campaigns_games_per_player_range', sql`${t.gamesPerPlayer} between 1 and 50`),
		check('campaigns_dates_in_order', sql`${t.endsOn} >= ${t.startsOn}`),
		check('campaigns_house_rules_array', sql`jsonb_typeof(${t.houseRules}) = 'array'`)
	]
);

/** Rights: the one CM and any co-CMs. A player is anyone in a seat (`seats`), kept apart from rights. */
export const members = campaignSchema.table(
	'members',
	{
		campaignId: uuid()
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id),
		role: memberRole().notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		primaryKey({ columns: [t.campaignId, t.userId] }),
		uniqueIndex('members_one_cm_key')
			.on(t.campaignId)
			.where(sql`${t.role} = 'cm'`),
		index('members_user_idx').on(t.userId)
	]
);

/** Places: numbered seats; a seat holds at most one person and a person at most one seat per campaign. */
export const seats = campaignSchema.table(
	'seats',
	{
		id: id(),
		campaignId: uuid()
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		number: smallint().notNull(),
		/** "Seat N" until someone joins; renamed to the player on join only while it still has that default. */
		name: text().notNull(),
		userId: uuid().references(() => users.id),
		joinedAt: timestamp({ withTimezone: true }),
		/** The seat holder's warband for this campaign; a warband sits in one seat at most. */
		warbandId: uuid().references((): AnyPgColumn => warbands.id, { onDelete: 'set null' }),
		version: integer().notNull().default(1),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('seats_number_key').on(t.campaignId, t.number),
		uniqueIndex('seats_one_per_person_key')
			.on(t.campaignId, t.userId)
			.where(sql`${t.userId} is not null`),
		index('seats_user_idx').on(t.userId),
		uniqueIndex('seats_warband_key').on(t.warbandId),
		check('seats_warband_with_user', sql`${t.warbandId} is null or ${t.userId} is not null`),
		check('seats_name_length', sql`char_length(${t.name}) between 1 and 40`),
		check('seats_joined_with_user', sql`(${t.userId} is null) = (${t.joinedAt} is null)`)
	]
);

/** One-time seat links (7 days); only the token hash is stored. Making a new link for a seat revokes its open one. */
export const seatInvites = campaignSchema.table(
	'seat_invites',
	{
		id: id(),
		seatId: uuid()
			.notNull()
			.references(() => seats.id, { onDelete: 'cascade' }),
		tokenHash: text().notNull(),
		/** The link itself, AES-256-GCM (services/link-cipher), so the CM can copy it again; null before 1 Nov 2026. */
		tokenEnc: text(),
		createdBy: uuid()
			.notNull()
			.references(() => users.id),
		/** Null: valid until the seat is taken or the link withdrawn. Links made before 1 Nov 2026 keep 7 days. */
		expiresAt: timestamp({ withTimezone: true }),
		/** First time the link page was opened. */
		openedAt: timestamp({ withTimezone: true }),
		usedAt: timestamp({ withTimezone: true }),
		usedBy: uuid().references(() => users.id),
		revokedAt: timestamp({ withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('seat_invites_token_key').on(t.tokenHash),
		index('seat_invites_open_idx')
			.on(t.seatId)
			.where(sql`${t.usedAt} is null and ${t.revokedAt} is null`)
	]
);

/** Asking to join a listed campaign while it musters; one open request per person per campaign. */
export const joinRequests = campaignSchema.table(
	'join_requests',
	{
		id: id(),
		campaignId: uuid()
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		userId: uuid()
			.notNull()
			.references(() => users.id),
		note: text().notNull().default(''),
		status: requestStatus().notNull().default('open'),
		decidedBy: uuid().references(() => users.id),
		decidedAt: timestamp({ withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		uniqueIndex('join_requests_one_open_key')
			.on(t.campaignId, t.userId)
			.where(sql`${t.status} = 'open'`),
		index('join_requests_user_idx').on(t.userId)
	]
);

export const rulesSchema = pgSchema('rules');

/**
 * A cache of the rules folders, rebuilt from RULES_DIR at start and on the Owner's Reload (one transaction). One row
 * per folder, loaded or not: `report` lists what is wrong with a folder that failed its check (it then has no
 * nodes). Never edited, so no updated_at or version.
 */
export const ruleSets = rulesSchema.table(
	'sets',
	{
		/** The folder name: core-1.0.2, carcass-front-1.0. */
		id: text().primaryKey(),
		name: text().notNull(),
		/** Null when the manifest could not be read. */
		kind: text(),
		version: text(),
		base: text(),
		checksum: text().notNull(),
		report: jsonb().$type<Problem[]>().notNull().default([]),
		ok: boolean().notNull(),
		loadedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		check('sets_kind', sql`${t.kind} in ('core', 'expansion', 'homebrew')`),
		check('sets_report_array', sql`jsonb_typeof(${t.report}) = 'array'`)
	]
);

/** The elements of a loaded set (its own only: a chain is read as several set ids). */
export const ruleNodes = rulesSchema.table(
	'nodes',
	{
		setId: text()
			.notNull()
			.references(() => ruleSets.id, { onDelete: 'cascade' }),
		id: text().notNull(),
		type: text().notNull(),
		name: text().notNull(),
		data: jsonb().$type<Record<string, unknown>>().notNull()
	},
	(t) => [
		primaryKey({ columns: [t.setId, t.id] }),
		index('nodes_name_idx').on(sql`lower(${t.name})`),
		index('nodes_type_idx').on(t.setId, t.type)
	]
);

const edgeKindList = sql.raw(EDGE_KINDS.map((k) => `'${k}'`).join(', '));

/** The links between elements; the key also serves lookups by (set_id, from_id). */
export const ruleEdges = rulesSchema.table(
	'edges',
	{
		setId: text()
			.notNull()
			.references(() => ruleSets.id, { onDelete: 'cascade' }),
		fromId: text().notNull(),
		toId: text().notNull(),
		kind: text().notNull()
	},
	(t) => [
		primaryKey({ columns: [t.setId, t.fromId, t.toId, t.kind] }),
		index('edges_to_idx').on(t.setId, t.toId),
		check('edges_kind', sql`${t.kind} in (${edgeKindList})`)
	]
);

export const warbandSchema = pgSchema('warband');

export const fighterGroup = warbandSchema.enum('fighter_group', GROUPS);

/**
 * A player's warband, as the warband engine reads it (app/src/lib/warbands): the rules it is built for (a core
 * folder and any expansions on it), the faction, variant and Patron ids, the ducat limit and the two banks. The
 * stash, fireteams and locations are typed JSONB (zod-checked engine shapes); the stash is a list of the armoury
 * line ids each piece was bought from, so it needs no table. Deleting the owner's account removes their warbands.
 */
export const warbands = warbandSchema.table(
	'warbands',
	{
		id: id(),
		ownerId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text().notNull(),
		rulesSet: text().notNull(),
		rulesExpansions: text()
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		factionId: text().notNull(),
		variantId: text(),
		patronId: text(),
		dedication: text(),
		ducatLimit: integer().notNull(),
		stashDucats: integer().notNull().default(0),
		unspentGlory: integer().notNull().default(0),
		stash: jsonb().$type<string[]>().notNull().default([]),
		fireteams: jsonb().$type<[string, string][]>().notNull().default([]),
		locations: jsonb().$type<{ name: string; note?: string }[]>().notNull().default([]),
		notes: text().notNull().default(''),
		version: integer().notNull().default(1),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('warbands_owner_idx').on(t.ownerId),
		check('warbands_name_length', sql`char_length(${t.name}) between 1 and 80`),
		check('warbands_ducat_limit_range', sql`${t.ducatLimit} between 0 and 100000`),
		check('warbands_notes_length', sql`char_length(${t.notes}) <= 4000`),
		check('warbands_stash_array', sql`jsonb_typeof(${t.stash}) = 'array'`),
		check('warbands_fireteams_array', sql`jsonb_typeof(${t.fireteams}) = 'array'`),
		check('warbands_locations_array', sql`jsonb_typeof(${t.locations}) = 'array'`)
	]
);

/**
 * One fighter of a warband, in roster order (`sort`: prices depend on it, the first copy of an entry may cost
 * less). Kit is the armoury line ids it was bought from; skills and injuries are ids or table rows, or free text.
 * `image` is the content type of its uploaded picture (the file lives in the uploads volume), null for none.
 */
export const fighters = warbandSchema.table(
	'fighters',
	{
		id: id(),
		warbandId: uuid()
			.notNull()
			.references(() => warbands.id, { onDelete: 'cascade' }),
		unitId: text().notNull(),
		name: text(),
		grp: fighterGroup().notNull(),
		kit: jsonb().$type<string[]>().notNull().default([]),
		upgrades: jsonb().$type<string[]>().notNull().default([]),
		skills: jsonb().$type<string[]>().notNull().default([]),
		injuries: jsonb().$type<string[]>().notNull().default([]),
		xp: integer().notNull().default(0),
		image: text(),
		sort: integer().notNull(),
		version: integer().notNull().default(1),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('fighters_warband_idx').on(t.warbandId, t.sort),
		check('fighters_name_length', sql`char_length(${t.name}) between 1 and 120`),
		check('fighters_xp_range', sql`${t.xp} between 0 and 1000`),
		check('fighters_image_type', sql`${t.image} in ('image/png', 'image/jpeg', 'image/webp')`),
		check('fighters_kit_array', sql`jsonb_typeof(${t.kit}) = 'array'`)
	]
);

export const homebrewSchema = pgSchema('homebrew');

export const homebrewKind = homebrewSchema.enum('kind', ['faction', 'variant', 'items']);
export const homebrewVisibility = homebrewSchema.enum('visibility', ['private', 'shared']);

/**
 * A player-made faction, variant or set of items: `data` is a whole rules set in the rules folder format (manifest
 * kind homebrew, base = `base_set`), saved even while it fails its check. The rules service indexes it into the
 * rules cache as set `hb:<id>` when it passes, else its last version that passed (`last_good`). Private until its
 * owner shares it with the install.
 */
export const homebrewSets = homebrewSchema.table(
	'homebrew_sets',
	{
		id: id(),
		ownerId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text().notNull(),
		kind: homebrewKind().notNull(),
		/** The rules set it builds on: a folder (core-1.0.2) or another homebrew set (hb:<id>). */
		baseSet: text().notNull(),
		visibility: homebrewVisibility().notNull().default('private'),
		data: jsonb().$type<Record<string, unknown>>().notNull(),
		/** The faction or variant id it was copied from, if any. */
		copiedFrom: text(),
		/** The current data's check problems (empty: it passes), written by every index. */
		report: jsonb().$type<Problem[]>().notNull().default([]),
		/**
		 * The last version that passed its checks: what the cache serves while a newer draft fails, so warbands built
		 * on a shared set keep loading. Null until a version passes.
		 */
		lastGood: jsonb().$type<{
			data: Record<string, unknown>;
			version: number;
			checkedAt: string;
		}>(),
		version: integer().notNull().default(1),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('homebrew_sets_owner_idx').on(t.ownerId),
		index('homebrew_sets_base_idx').on(t.baseSet),
		check('homebrew_sets_name_length', sql`char_length(${t.name}) between 1 and 80`),
		check('homebrew_sets_data_object', sql`jsonb_typeof(${t.data}) = 'object'`),
		check('homebrew_sets_report_array', sql`jsonb_typeof(${t.report}) = 'array'`)
	]
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type Role = (typeof role.enumValues)[number];
export type SettingsRow = typeof settings.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Seat = typeof seats.$inferSelect;
export type SeatInvite = typeof seatInvites.$inferSelect;
export type JoinRequest = typeof joinRequests.$inferSelect;
export type RuleSetRow = typeof ruleSets.$inferSelect;
export type RuleNodeRow = typeof ruleNodes.$inferSelect;
export type RuleEdgeRow = typeof ruleEdges.$inferSelect;
export type WarbandRow = typeof warbands.$inferSelect;
export type FighterRow = typeof fighters.$inferSelect;
export type HomebrewRow = typeof homebrewSets.$inferSelect;
