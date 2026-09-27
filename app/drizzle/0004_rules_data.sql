CREATE TABLE "rules_item" (
	"id" text PRIMARY KEY NOT NULL,
	"faction" text NOT NULL,
	"variant" text,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"unique" boolean DEFAULT false NOT NULL,
	"cost" integer NOT NULL,
	"currency" text DEFAULT 'ducats' NOT NULL,
	"limit" integer,
	"restrictions" text,
	"type" text,
	"range" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"text" text,
	"description" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules_keyword" (
	"name" text PRIMARY KEY NOT NULL,
	"kind" text,
	"text" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules_unit" (
	"id" text PRIMARY KEY NOT NULL,
	"faction" text NOT NULL,
	"variant" text,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"availability_min" integer DEFAULT 0 NOT NULL,
	"availability_max" integer,
	"cost" integer NOT NULL,
	"currency" text DEFAULT 'ducats' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"abilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"battlekit_note" text,
	"powers" text,
	"description" text,
	"page" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rules_item_faction_idx" ON "rules_item" USING btree ("faction");--> statement-breakpoint
CREATE INDEX "rules_unit_faction_idx" ON "rules_unit" USING btree ("faction");