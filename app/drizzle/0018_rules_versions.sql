CREATE TABLE "rules_version" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'book' NOT NULL,
	"hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "rules_version" text;