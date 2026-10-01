CREATE TABLE "rules_patron" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"alignment" text,
	"factions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text,
	"verified" boolean DEFAULT false NOT NULL,
	"origin" text DEFAULT 'book' NOT NULL
);
