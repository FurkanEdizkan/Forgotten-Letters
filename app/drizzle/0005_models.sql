CREATE TABLE `model` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`kind` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`stl` text,
	`token` text NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_owner_idx` ON `model` (`campaign_id`,`kind`,`owner_type`,`owner_id`);