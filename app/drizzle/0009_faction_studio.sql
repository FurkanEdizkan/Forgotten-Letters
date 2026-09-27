CREATE TABLE "custom_faction" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"alignment" text DEFAULT 'faithful' NOT NULL,
	"parent" text,
	"description" text,
	"colours" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rules_faction" ADD COLUMN "origin" text DEFAULT 'book' NOT NULL;--> statement-breakpoint
ALTER TABLE "rules_faction" ADD COLUMN "overrides" jsonb;--> statement-breakpoint
ALTER TABLE "rules_item" ADD COLUMN "origin" text DEFAULT 'book' NOT NULL;--> statement-breakpoint
ALTER TABLE "rules_item" ADD COLUMN "stipulations" jsonb;--> statement-breakpoint
ALTER TABLE "rules_item" ADD COLUMN "book_copy" jsonb;--> statement-breakpoint
ALTER TABLE "rules_keyword" ADD COLUMN "origin" text DEFAULT 'book' NOT NULL;--> statement-breakpoint
ALTER TABLE "rules_unit" ADD COLUMN "origin" text DEFAULT 'book' NOT NULL;--> statement-breakpoint
ALTER TABLE "rules_unit" ADD COLUMN "kit" jsonb;--> statement-breakpoint
ALTER TABLE "rules_unit" ADD COLUMN "book_copy" jsonb;