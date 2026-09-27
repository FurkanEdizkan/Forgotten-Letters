import { integer, sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core';

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
