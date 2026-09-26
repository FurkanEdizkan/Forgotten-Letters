CREATE TABLE `adjustment` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`warband_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text,
	`note` text,
	`committed_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`warband_id`) REFERENCES `warband`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `adjustment_campaign_idx` ON `adjustment` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`games_per_player` integer DEFAULT 8 NOT NULL,
	`random_scenario_turns` integer DEFAULT 4 NOT NULL,
	`house_zones` integer DEFAULT true NOT NULL,
	`house_razing` integer DEFAULT false NOT NULL,
	`house_outpost_levy` integer DEFAULT false NOT NULL,
	`visions_revealed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fx_state` (
	`campaign_id` text PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`zone` text NOT NULL,
	`aggressor_id` text NOT NULL,
	`defender_id` text NOT NULL,
	`winner_id` text,
	`scenario` text,
	`weather_event` integer,
	`weather_rolls` text,
	`result` text,
	`committed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`aggressor_id`) REFERENCES `warband`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`defender_id`) REFERENCES `warband`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `warband`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `game_campaign_idx` ON `game` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`seat` integer,
	`name` text NOT NULL,
	`portrait` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_campaign_idx` ON `player` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `region_weather` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text,
	`zones` text,
	`weather_event` integer,
	`fx` text,
	`active` integer DEFAULT true NOT NULL,
	`games_remaining` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `warband` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`player_id` text NOT NULL,
	`name` text NOT NULL,
	`faction` text NOT NULL,
	`variant` text,
	`patron` text,
	`symbol` text,
	`entry_zone` text NOT NULL,
	`vision_card` text,
	`vision_progress` integer DEFAULT 0 NOT NULL,
	`vision_notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `warband_campaign_idx` ON `warband` (`campaign_id`);