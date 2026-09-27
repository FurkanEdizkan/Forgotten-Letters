import { integer, sqliteTable, text, index, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date());

export const campaign = sqliteTable('campaign', {
	id: id(),
	name: text('name').notNull(),
	gamesPerPlayer: integer('games_per_player').notNull().default(8),
	expectedPlayers: integer('expected_players').notNull().default(8),
	randomScenarioTurns: integer('random_scenario_turns').notNull().default(4),
	gloryScoring: text('glory_scoring', { enum: ['boxIndex', 'deeds', 'none'] })
		.notNull()
		.default('boxIndex'),
	houseZones: integer('house_zones', { mode: 'boolean' }).notNull().default(true),
	houseRazing: integer('house_razing', { mode: 'boolean' }).notNull().default(false),
	houseOutpostLevy: integer('house_outpost_levy', { mode: 'boolean' }).notNull().default(false),
	visionsRevealed: integer('visions_revealed', { mode: 'boolean' }).notNull().default(false),
	createdAt: createdAt()
});

export const player = sqliteTable(
	'player',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		seat: integer('seat'),
		name: text('name').notNull(),
		portrait: text('portrait'),
		createdAt: createdAt()
	},
	(t) => [index('player_campaign_idx').on(t.campaignId)]
);

export const warband = sqliteTable(
	'warband',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		playerId: text('player_id')
			.notNull()
			.references(() => player.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		faction: text('faction').notNull(),
		variant: text('variant'),
		patron: text('patron'),
		symbol: text('symbol'),
		entryZone: text('entry_zone').notNull(),
		// Secret until campaign.visionsRevealed — never sent to public views.
		visionCard: text('vision_card'),
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
		createdAt: createdAt()
	},
	(t) => [index('warband_campaign_idx').on(t.campaignId)]
);

export const game = sqliteTable(
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
		weatherRolls: text('weather_rolls', { mode: 'json' }),
		// Per-side result entry: deeds, resource boxes, exploration, loot, rewards chosen.
		result: text('result', { mode: 'json' }),
		// Replay order key: set when the game is committed as done.
		committedAt: integer('committed_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt()
	},
	(t) => [index('game_campaign_idx').on(t.campaignId)]
);

export const adjustment = sqliteTable(
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
		payload: text('payload', { mode: 'json' }),
		note: text('note'),
		committedAt: integer('committed_at', { mode: 'timestamp_ms' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('adjustment_campaign_idx').on(t.campaignId)]
);

export const regionWeather = sqliteTable('region_weather', {
	id: id(),
	campaignId: text('campaign_id')
		.notNull()
		.references(() => campaign.id, { onDelete: 'cascade' }),
	name: text('name'),
	// Zone ids, or null for the whole map.
	zones: text('zones', { mode: 'json' }).$type<string[] | null>(),
	weatherEvent: integer('weather_event'),
	fx: text('fx', { mode: 'json' }),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	gamesRemaining: integer('games_remaining'),
	createdAt: createdAt()
});

export const fxState = sqliteTable('fx_state', {
	campaignId: text('campaign_id')
		.primaryKey()
		.references(() => campaign.id, { onDelete: 'cascade' }),
	config: text('config', { mode: 'json' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date())
});

/** Lore for a map zone, written by the Campaign Master (public). */
export const zoneLore = sqliteTable(
	'zone_lore',
	{
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		zoneId: text('zone_id').notNull(),
		lore: text('lore').notNull().default(''),
		image: text('image'),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
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
export const unit = sqliteTable(
	'unit',
	{
		id: id(),
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaign.id, { onDelete: 'cascade' }),
		warbandId: text('warband_id')
			.notNull()
			.references(() => warband.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		type: text('type').notNull().default(''),
		category: text('category', { enum: ['elite', 'troop', 'mercenary'] })
			.notNull()
			.default('troop'),
		leader: integer('leader', { mode: 'boolean' }).notNull().default(false),
		cost: integer('cost').notNull().default(0),
		currency: text('currency', { enum: ['ducats', 'glory'] })
			.notNull()
			.default('ducats'),
		experience: integer('experience').notNull().default(0),
		equipment: text('equipment', { mode: 'json' }).$type<RosterItem[]>().notNull().default([]),
		upgrades: text('upgrades', { mode: 'json' }).$type<string[]>().notNull().default([]),
		skills: text('skills', { mode: 'json' }).$type<string[]>().notNull().default([]),
		injuries: text('injuries', { mode: 'json' }).$type<string[]>().notNull().default([]),
		stats: text('stats', { mode: 'json' }).$type<UnitStats>().notNull().default({}),
		notes: text('notes'),
		photo: text('photo'),
		status: text('status', { enum: ['active', 'dead', 'retired'] })
			.notNull()
			.default('active'),
		sort: integer('sort').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('unit_warband_idx').on(t.warbandId)]
);

/** Items held in the warband's stash (paychest) rather than by a model. */
export const warbandStash = sqliteTable(
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
export const model = sqliteTable(
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
		params: text('params', { mode: 'json' }).$type<ModelParams>().notNull().default({}),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
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
