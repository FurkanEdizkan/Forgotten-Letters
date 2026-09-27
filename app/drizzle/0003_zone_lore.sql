CREATE TABLE `zone_lore` (
	`campaign_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`lore` text DEFAULT '' NOT NULL,
	`image` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`campaign_id`, `zone_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
