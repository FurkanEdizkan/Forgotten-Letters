CREATE TABLE `unit` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`warband_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'troop' NOT NULL,
	`leader` integer DEFAULT false NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'ducats' NOT NULL,
	`experience` integer DEFAULT 0 NOT NULL,
	`equipment` text DEFAULT '[]' NOT NULL,
	`upgrades` text DEFAULT '[]' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`injuries` text DEFAULT '[]' NOT NULL,
	`stats` text DEFAULT '{}' NOT NULL,
	`notes` text,
	`photo` text,
	`status` text DEFAULT 'active' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`warband_id`) REFERENCES `warband`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unit_warband_idx` ON `unit` (`warband_id`);--> statement-breakpoint
CREATE TABLE `warband_stash` (
	`id` text PRIMARY KEY NOT NULL,
	`warband_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'equipment' NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'ducats' NOT NULL,
	FOREIGN KEY (`warband_id`) REFERENCES `warband`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stash_warband_idx` ON `warband_stash` (`warband_id`);--> statement-breakpoint
ALTER TABLE `warband` ADD `treasury_ducats` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `warband` ADD `treasury_glory` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `warband` ADD `roster_notes` text;--> statement-breakpoint
ALTER TABLE `warband` ADD `display_model` text DEFAULT 'portrait' NOT NULL;