import { type AnyPgColumn, boolean, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import type { SealSettings } from '$lib/seals';
import type { RulesOverride, StipulationsOverride, UnitKitOverride } from '$lib/warband-rules';
import type { Zone } from '$lib/rules/types';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	timestamp('created_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date());

export const campaign = pgTable('campaign', {
	id: id(),
	name: text('name').notNull(),
	gamesPerPlayer: integer('games_per_player').notNull().default(8),
	expectedPlayers: integer('expected_players').notNull().default(8),
	randomScenarioTurns: integer('random_scenario_turns').notNull().default(4),
	gloryScoring: text('glory_scoring', { enum: ['boxIndex', 'deeds', 'none'] })
		.notNull()
		.default('boxIndex'),
	houseZones: boolean('house_zones').notNull().default(true),
	houseRazing: boolean('house_razing').notNull().default(false),
	houseOutpostLevy: boolean('house_outpost_levy').notNull().default(false),
	visionsRevealed: boolean('visions_revealed').notNull().default(false),
	/**
	 * Where the campaign is in its life: the Campaign Master sets it up, players muster (join, build warbands,
	 * choose Visions), then rounds of battles until the end. Existing campaigns migrate straight to `underway`;
	 * a newly founded one is created at `setup`.
	 */
	stage: text('stage', { enum: ['setup', 'mustering', 'underway', 'ended'] })
		.notNull()
		.default('underway'),
	/**
	 * What a warband loses when the Campaign Master passes it for a round it failed to plan without telling anyone:
	 * CVP, Glory and Ducats taken away, and boxes off resource tracks. The pass counts as a game played.
	 */
	passPenalty: jsonb('pass_penalty')
		.$type<{ cvp: number; glory: number; ducats: number; boxes: Partial<Record<'F' | 'R' | 'S' | 'T', number>> }>()
		.notNull()
		.default({ cvp: 0, glory: 0, ducats: 0, boxes: {} }),
	/** The campaign map, uploaded in Admin → Map (/uploads path), and its size in pixels. Null: a plain parchment. */
	mapImage: text('map_image'),
	mapWidth: integer('map_width'),
	mapHeight: integer('map_height'),
	createdAt: createdAt()
});

/** The map's zones, placed in the Map Studio (seeded from the Carcass Front preset). Fields as `Zone`. */
export const mapZone = pgTable(
	'map_zone',
	{
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		id: text('id').notNull(),
		/** Order on the map (numbering of drawn zones). */
		order: integer('order').notNull().default(0),
		zone: jsonb('zone').$type<Zone>().notNull()
	},
	(t) => [primaryKey({ columns: [t.campaignId, t.id] })]
);

export const player = pgTable(
	'player',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		seat: integer('seat'),
		name: text('name').notNull(),
		portrait: text('portrait'),
		/** The account that plays this seat (and edits its warbands), if any. */
		userId: text('user_id').references((): AnyPgColumn => user.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('player_campaign_idx').on(t.campaignId)]
);

export const warband = pgTable(
	'warband',
	{
		id: id(),
		/** Null for a player's own list, which is not (yet) in the campaign. */
		campaignId: text('campaign_id').references(() => campaign.id, { onDelete: 'cascade' }),
		playerId: text('player_id').references(() => player.id, { onDelete: 'cascade' }),
		/** The account a list belongs to (lists live outside the campaign until one is used for it). */
		listOwnerId: text('list_owner_id').references((): AnyPgColumn => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		faction: text('faction').notNull(),
		variant: text('variant'),
		patron: text('patron'),
		symbol: text('symbol'),
		entryZone: text('entry_zone'),
		// Secret until campaign.visionsRevealed — never sent to public views.
		visionCard: text('vision_card'),
		/** The two Vision cards dealt at mustering, one of which the player keeps (secret until the reveal). */
		visionOffer: jsonb('vision_offer').$type<string[]>(),
		visionProgress: integer('vision_progress').notNull().default(0),
		visionNotes: text('vision_notes'),
		/** Roster bank (the base game's Quartermaster). */
		treasuryDucats: integer('treasury_ducats').notNull().default(0),
		treasuryGlory: integer('treasury_glory').notNull().default(0),
		rosterNotes: text('roster_notes'),
		/** Map marker: the player's portrait, or the warband's model token. */
		displayModel: text('display_model', { enum: ['portrait', 'model'] })
			.notNull()
			.default('portrait'),
		/** How the warband's seal looks: colours, and an optional seal struck from the player's own symbol. */
		seal: jsonb('seal').$type<SealSettings>(),
		/** Trench Companion's "Remove Restrictions": the builder skips availability and item limits. */
		unrestricted: boolean('unrestricted').notNull().default(false),
		/** "Open Exploration": exploration-only battlekit may be bought. */
		openExploration: boolean('open_exploration').notNull().default(false),
		/** Fireteams: named groups of models (unit ids); a model may be in more than one. */
		fireteams: jsonb('fireteams').$type<{ name: string; members: string[] }[]>().notNull().default([]),
		/** The warband's own lore (notes are rosterNotes). */
		lore: text('lore'),

		createdAt: createdAt()
	},
	(t) => [index('warband_campaign_idx').on(t.campaignId)]
);

export const game = pgTable(
	'game',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		status: text('status', { enum: ['scheduled', 'in_progress', 'done'] })
			.notNull()
			.default('scheduled'),
		zone: text('zone').notNull(),
		/** The round of battles this game belongs to; null for a battle the Campaign Master arranged by hand. */
		roundId: text('round_id').references((): AnyPgColumn => round.id, { onDelete: 'set null' }),
		aggressorId: text('aggressor_id')
			.notNull()
			.references(() => warband.id),
		defenderId: text('defender_id')
			.notNull()
			.references(() => warband.id),
		winnerId: text('winner_id').references(() => warband.id),
		scenario: text('scenario'),
		weatherEvent: integer('weather_event'),
		// { aggressor: [d,d], defender: [d,d], chosenBy }
		weatherRolls: jsonb('weather_rolls'),
		// Per-side result entry: deeds, resource boxes, exploration, loot, rewards chosen.
		result: jsonb('result'),
		// Replay order key: set when the game is committed as done.
		committedAt: timestamp('committed_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt()
	},
	(t) => [index('game_campaign_idx').on(t.campaignId)]
);

export const adjustment = pgTable(
	'adjustment',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		warbandId: text('warband_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		payload: jsonb('payload'),
		note: text('note'),
		committedAt: timestamp('committed_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('adjustment_campaign_idx').on(t.campaignId)]
);

export const regionWeather = pgTable('region_weather', {
	id: id(),
	campaignId: text('campaign_id')
		.notNull()
		.references(() => campaign.id, { onDelete: 'cascade' }),
	name: text('name'),
	// Zone ids, or null for the whole map.
	zones: jsonb('zones').$type<string[] | null>(),
	weatherEvent: integer('weather_event'),
	fx: jsonb('fx'),
	active: boolean('active').notNull().default(true),
	gamesRemaining: integer('games_remaining'),
	createdAt: createdAt()
});

export const fxState = pgTable('fx_state', {
	campaignId: text('campaign_id')
		.primaryKey()
		.references(() => campaign.id, { onDelete: 'cascade' }),
	config: jsonb('config').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.$defaultFn(() => new Date())
});

/** Lore for a map zone, written by the Campaign Master (public). */
export const zoneLore = pgTable(
	'zone_lore',
	{
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		zoneId: text('zone_id').notNull(),
		lore: text('lore').notNull().default(''),
		image: text('image'),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [primaryKey({ columns: [t.campaignId, t.zoneId] })]
);

export interface RosterItem {
	name: string;
	kind: 'ranged' | 'melee' | 'armour' | 'equipment';
	cost: number;
	currency: 'ducats' | 'glory';
}

export interface UnitStats {
	movement?: string;
	ranged?: string;
	melee?: string;
	armour?: string;
	base?: string;
}

/** A model on a warband roster, shaped like Trench Companion's per-model data. */
export const unit = pgTable(
	'unit',
	{
		id: id(),
		/** Null for a model in a player's list (outside the campaign). */
		campaignId: text('campaign_id').references(() => campaign.id, { onDelete: 'cascade' }),
		warbandId: text('warband_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: text('type').notNull().default(''),
		category: text('category', { enum: ['elite', 'troop', 'mercenary'] })
			.notNull()
			.default('troop'),
		leader: boolean('leader').notNull().default(false),
		cost: integer('cost').notNull().default(0),
		currency: text('currency', { enum: ['ducats', 'glory'] })
			.notNull()
			.default('ducats'),
		experience: integer('experience').notNull().default(0),
		equipment: jsonb('equipment').$type<RosterItem[]>().notNull().default([]),
		upgrades: jsonb('upgrades').$type<string[]>().notNull().default([]),
		skills: jsonb('skills').$type<string[]>().notNull().default([]),
		injuries: jsonb('injuries').$type<string[]>().notNull().default([]),
		stats: jsonb('stats').$type<UnitStats>().notNull().default({}),
		notes: text('notes'),
		photo: text('photo'),
		/** The rules entry this model was recruited as (rules_unit.id), for its profile, keywords and abilities. */
		profileId: text('profile_id'),
		status: text('status', { enum: ['active', 'dead', 'retired'] })
			.notNull()
			.default('active'),
		sort: integer('sort').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('unit_warband_idx').on(t.warbandId)]
);

/** Items held in the warband's stash (paychest) rather than by a model. */
export const warbandStash = pgTable(
	'warband_stash',
	{
		id: id(),
		warbandId: text('warband_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		kind: text('kind', { enum: ['ranged', 'melee', 'armour', 'equipment'] })
			.notNull()
			.default('equipment'),
		cost: integer('cost').notNull().default(0),
		currency: text('currency', { enum: ['ducats', 'glory'] })
			.notNull()
			.default('ducats')
	},
	(t) => [index('stash_warband_idx').on(t.warbandId)]
);

/**
 * A 3D model uploaded as STL and rendered to a map token in the browser.
 * Owned by a faction (the campaign default for that faction) or by one warband.
 */
export const model = pgTable(
	'model',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['outpost', 'figure'] }).notNull(),
		ownerType: text('owner_type', { enum: ['faction', 'warband'] }).notNull(),
		/** Faction id or warband id, depending on ownerType. */
		ownerId: text('owner_id').notNull(),
		/** Private path of the source STL (served to the Campaign Master only). */
		stl: text('stl'),
		/** Public /uploads path of the rendered WebP token. */
		token: text('token').notNull(),
		params: jsonb('params').$type<ModelParams>().notNull().default({}),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [uniqueIndex('model_owner_idx').on(t.campaignId, t.kind, t.ownerType, t.ownerId)]
);

export interface ModelParams {
	yaw?: number;
	pitch?: number;
	scale?: number;
	tint?: string;
	/** Rotate Z-up files (most miniature STLs) to Y-up. */
	zUp?: boolean;
}


/**
 * The default picture for a unit type in a faction (e.g. every "Trench Pilgrim"), set by the
 * Campaign Master. A unit's own photo, if any, takes precedence.
 */
export const unitArt = pgTable(
	'unit_art',
	{
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		faction: text('faction').notNull(),
		/** The unit type as letters only, lowercase, so "Trench-Pilgrim" and "Trench Pilgrim" share art. */
		typeKey: text('type_key').notNull(),
		type: text('type').notNull(),
		image: text('image').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [primaryKey({ columns: [t.campaignId, t.faction, t.typeKey] })]
);

/** Accounts: the Campaign Master and the players. Made by the CM, or requested at sign-in and approved by the CM. */
export const user = pgTable('user', {
	id: id(),
	/** Lowercase, unique. */
	username: text('username').notNull().unique(),
	displayName: text('display_name'),
	/** Optional, lowercase, unique when given. Stored for the Campaign Master's records; nothing is sent to it yet. */
	email: text('email').unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['cm', 'player'] })
		.notNull()
		.default('player'),
	disabled: boolean('disabled').notNull().default(false),
	/** Set when the CM issues or resets a password; the user must choose their own on next sign-in. */
	mustChangePassword: boolean('must_change_password').notNull().default(true),
	lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true, mode: 'date' }),
	lastSignInIp: text('last_sign_in_ip'),
	/** Last request from any of its devices (kept to the minute by the activity flush). */
	lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }),
	createdAt: createdAt(),
	// A database default too, so the migration can add it to existing rows.
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date())
});

/**
 * A round of battles. Every eligible warband rolls (the Aggressors are decided), each Aggressor in turn picks an
 * opponent and a battlefield, the battles are fought and recorded, and the round closes.
 */
export const round = pgTable(
	'round',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		number: integer('number').notNull(),
		step: text('step', { enum: ['rolling', 'pairing', 'battles', 'closed'] })
			.notNull()
			.default('rolling'),
		createdAt: createdAt(),
		closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' })
	},
	(t) => [uniqueIndex('round_campaign_number_idx').on(t.campaignId, t.number)]
);

/** One warband in a round: its rolls for the Aggressor roll-off, and the role it ended with. */
export const roundEntry = pgTable(
	'round_entry',
	{
		roundId: text('round_id')
			.notNull()
			.references(() => round.id, { onDelete: 'cascade' }),
		warbandId: text('warband_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		/** Times Aggressor before this round (frozen when the round opens). */
		aggressions: integer('aggressions').notNull().default(0),
		/** The warband's own round when this round opened: warbands are paired only within the same round. */
		playerRound: integer('player_round').notNull().default(1),
		/** D6 rolls: the first, then any re-rolls. */
		rolls: jsonb('rolls').$type<number[]>().notNull().default([]),
		role: text('role', { enum: ['aggressor', 'defender', 'bye', 'passed'] }),
		/** Aggressors' picking order (1 = first). */
		pickOrder: integer('pick_order')
	},
	(t) => [primaryKey({ columns: [t.roundId, t.warbandId] })]
);

/**
 * A challenge: an Aggressor names an opponent and a battlefield, and the opponent accepts (the battle goes on the
 * map) or declines. From a round's picking (roundId set) or arranged by the players at any time (roundId null).
 */
export const challenge = pgTable(
	'challenge',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		roundId: text('round_id').references((): AnyPgColumn => round.id, { onDelete: 'cascade' }),
		aggressorId: text('aggressor_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		defenderId: text('defender_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		zone: text('zone').notNull(),
		status: text('status', { enum: ['pending', 'accepted', 'declined', 'withdrawn'] })
			.notNull()
			.default('pending'),
		/** The battle it became, once accepted. */
		gameId: text('game_id').references((): AnyPgColumn => game.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		answeredAt: timestamp('answered_at', { withTimezone: true, mode: 'date' })
	},
	(t) => [index('challenge_campaign_idx').on(t.campaignId, t.status)]
);

/** An invitation to take one seat: the link carries a random token, only its hash is kept. Single use, expires. */
export const invite = pgTable(
	'invite',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		playerId: text('player_id')
			.notNull()
			.references(() => player.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		createdBy: text('created_by').references((): AnyPgColumn => user.id, { onDelete: 'set null' }),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
		usedBy: text('used_by').references((): AnyPgColumn => user.id, { onDelete: 'set null' }),
		revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
		createdAt: createdAt()
	},
	(t) => [index('invite_player_idx').on(t.playerId)]
);

/** Sign-up and password-reset requests from the sign-in page, waiting for the Campaign Master. */
export const accountRequest = pgTable(
	'account_request',
	{
		id: id(),
		kind: text('kind', { enum: ['signup', 'reset'] }).notNull(),
		/** Lowercase, as in `user`. */
		username: text('username').notNull(),
		/** Sign-ups only. */
		displayName: text('display_name'),
		/** Sign-ups only, optional. */
		email: text('email'),
		/** Sign-ups only: the password the player chose, already hashed. */
		passwordHash: text('password_hash'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('account_request_kind_username_idx').on(t.kind, t.username)]
);

/** Signed-in devices. The cookie holds a random token; only its hash is kept here. */
export const session = pgTable(
	'session',
	{
		idHash: text('id_hash').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		userAgent: text('user_agent'),
		/** The device: where it signed in from, and where it was last seen. */
		ip: text('ip'),
		lastIp: text('last_ip'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(t) => [index('session_user_idx').on(t.userId)]
);

/**
 * What happened to accounts and what the Campaign Master changed: sign-ins (and failures), sign-outs, password
 * changes, resets, sign-up requests and approvals (`auth`), and every admin form action or API call (`admin`).
 * Never holds form bodies or passwords. Pruned after AUDIT_RETENTION_DAYS.
 */
export const auditLog = pgTable(
	'audit_log',
	{
		id: id(),
		at: timestamp('at', { withTimezone: true, mode: 'date' })
			.notNull()
			.$defaultFn(() => new Date()),
		category: text('category', { enum: ['auth', 'admin'] }).notNull(),
		/** e.g. `signin.ok`, `signin.fail`, `password.change`, `admin.games.start`. */
		action: text('action').notNull(),
		/** Who did it: null for a visitor, or once the account is deleted (actorName keeps the name). */
		actorId: text('actor_id').references((): AnyPgColumn => user.id, { onDelete: 'set null' }),
		actorName: text('actor_name'),
		targetType: text('target_type'),
		targetId: text('target_id'),
		ip: text('ip'),
		userAgent: text('user_agent'),
		/** HTTP status of an admin request. */
		status: integer('status'),
		detail: jsonb('detail').$type<Record<string, unknown>>()
	},
	(t) => [index('audit_log_at_idx').on(t.at), index('audit_log_actor_idx').on(t.actorId, t.at), index('audit_log_category_idx').on(t.category, t.at)]
);

/** How much each account uses the site, one row per day (UTC), flushed from a buffer every minute. */
export const userActivity = pgTable(
	'user_activity',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		day: date('day', { mode: 'string' }).notNull(),
		requests: integer('requests').notNull().default(0),
		pageViews: integer('page_views').notNull().default(0),
		firstSeenAt: timestamp('first_seen_at', { withTimezone: true, mode: 'date' }).notNull(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true, mode: 'date' }).notNull(),
		lastIp: text('last_ip')
	},
	(t) => [primaryKey({ columns: [t.userId, t.day] })]
);

/*
 * Rules data, imported from the group's own rulebooks (scripts/import-rules.py) and shared by every
 * campaign on this install. Never committed. Rows the CM marks verified survive later imports.
 */
export const rulesUnit = pgTable(
	'rules_unit',
	{
		id: text('id').primaryKey(),
		faction: text('faction').notNull(),
		variant: text('variant'),
		name: text('name').notNull(),
		category: text('category', { enum: ['elite', 'troop', 'mercenary'] }).notNull(),
		availabilityMin: integer('availability_min').notNull().default(0),
		/** Null: any number. */
		availabilityMax: integer('availability_max'),
		cost: integer('cost').notNull(),
		currency: text('currency', { enum: ['ducats', 'glory'] }).notNull().default('ducats'),
		stats: jsonb('stats').$type<UnitStats>().notNull().default({}),
		keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
		abilities: jsonb('abilities').$type<{ name: string; text: string }[]>().notNull().default([]),
		battlekitNote: text('battlekit_note'),
		powers: text('powers'),
		description: text('description'),
		page: text('page'),
		verified: boolean('verified').notNull().default(false),
		/** Where the row came from: the books, authored in the Faction Studio, or a book entry edited as a house rule. */
		origin: text('origin', { enum: ['book', 'custom', 'edited'] }).notNull().default('book'),
		/** Builder facts set by hand (they win over what is read from the battlekit note). */
		kit: jsonb('kit').$type<UnitKitOverride>(),
		/** The book's version, kept when an entry is first edited, for "Revert to book". */
		bookCopy: jsonb('book_copy').$type<Record<string, unknown>>()
	},
	(t) => [index('rules_unit_faction_idx').on(t.faction)]
);

export const rulesItem = pgTable(
	'rules_item',
	{
		id: text('id').primaryKey(),
		faction: text('faction').notNull(),
		variant: text('variant'),
		category: text('category', { enum: ['ranged', 'melee', 'grenade', 'armour', 'shield', 'equipment', 'special'] }).notNull(),
		name: text('name').notNull(),
		/** Marked [•] in the armoury: only this faction has it. */
		unique: boolean('unique').notNull().default(false),
		cost: integer('cost').notNull(),
		currency: text('currency', { enum: ['ducats', 'glory'] }).notNull().default('ducats'),
		limit: integer('limit'),
		restrictions: text('restrictions'),
		type: text('type'),
		range: text('range'),
		keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
		text: text('text'),
		description: text('description'),
		verified: boolean('verified').notNull().default(false),
		origin: text('origin', { enum: ['book', 'custom', 'edited'] }).notNull().default('book'),
		/** Stipulations set by hand (they win over what is read from the restrictions text). */
		stipulations: jsonb('stipulations').$type<StipulationsOverride>(),
		bookCopy: jsonb('book_copy').$type<Record<string, unknown>>()
	},
	(t) => [index('rules_item_faction_idx').on(t.faction)]
);

/** Each faction's (variant null) and variant's special rules as printed: starting money, exclusions, upgrades… */
export const rulesFaction = pgTable('rules_faction', {
	/** `${faction}:${variant ?? ''}` */
	id: text('id').primaryKey(),
	faction: text('faction').notNull(),
	variant: text('variant'),
	/** Paragraphs separated by blank lines, one per rule ("* Name: text"). */
	text: text('text').notNull(),
	page: text('page'),
	verified: boolean('verified').notNull().default(false),
	origin: text('origin', { enum: ['book', 'custom', 'edited'] }).notNull().default('book'),
	/** Builder rules set by hand (starting money, exclusions, upgrades…); they win over the parsed text. */
	overrides: jsonb('overrides').$type<RulesOverride>()
});

/** A faction or variant authored in the Faction Studio (the books' own are in lib/rules/factions.ts). */
export const customFaction = pgTable('custom_faction', {
	/** Slug; for a variant, the variant's name is its identity within the parent. */
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	alignment: text('alignment', { enum: ['faithful', 'fallen'] }).notNull().default('faithful'),
	/** Null for a new faction; else the faction this variant belongs to. */
	parent: text('parent'),
	description: text('description'),
	colours: jsonb('colours').$type<{ metal: string; low: string; high: string }>(),
	createdAt: createdAt()
});

export const rulesKeyword = pgTable('rules_keyword', {
	name: text('name').primaryKey(),
	kind: text('kind'),
	text: text('text').notNull(),
	verified: boolean('verified').notNull().default(false),
	origin: text('origin', { enum: ['book', 'custom', 'edited'] }).notNull().default('book')
});

/** Core rules, campaign rules and scenarios, one page per heading of the book. */
export const rulesPage = pgTable('rules_page', {
	slug: text('slug').primaryKey(),
	book: text('book', { enum: ['core', 'campaign', 'scenario'] }).notNull(),
	chapter: text('chapter').notNull(),
	title: text('title').notNull(),
	order: integer('order').notNull().default(0),
	/** Paragraphs separated by blank lines; "### " sub-headings, "| a | b" table rows, "* " bullets. */
	body: text('body').notNull(),
	/** Battlefield maps cropped from the book (WebP data URLs), shown above the text. */
	maps: jsonb('maps').$type<{ src: string; width: number; height: number }[]>().notNull().default([]),
	source: text('source'),
	page: text('page'),
	verified: boolean('verified').notNull().default(false)
});
