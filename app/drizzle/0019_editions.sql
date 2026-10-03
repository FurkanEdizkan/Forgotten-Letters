-- Editions of the rules: every rules row belongs to one; all existing rules are edition 1.0.2.
CREATE TABLE "edition" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"based_on" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"current" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "edition_one_current" ON "edition" USING btree ("current") WHERE "edition"."current";
--> statement-breakpoint
INSERT INTO "edition" ("id", "name", "status", "current", "created_at") VALUES ('1.0.2', 'Rulebook and Warbands 1.0.2 with errata, Carcass Front', 'live', true, now());
--> statement-breakpoint
DROP INDEX "rules_item_faction_idx";
--> statement-breakpoint
DROP INDEX "rules_unit_faction_idx";
--> statement-breakpoint
ALTER TABLE "rules_faction" ADD COLUMN "edition" text NOT NULL DEFAULT '1.0.2';
--> statement-breakpoint
ALTER TABLE "rules_faction" ALTER COLUMN "edition" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rules_faction" DROP CONSTRAINT "rules_faction_pkey";
--> statement-breakpoint
ALTER TABLE "rules_faction" ADD CONSTRAINT "rules_faction_edition_id_pk" PRIMARY KEY("edition","id");
--> statement-breakpoint
ALTER TABLE "rules_item" ADD COLUMN "edition" text NOT NULL DEFAULT '1.0.2';
--> statement-breakpoint
ALTER TABLE "rules_item" ALTER COLUMN "edition" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rules_item" DROP CONSTRAINT "rules_item_pkey";
--> statement-breakpoint
ALTER TABLE "rules_item" ADD CONSTRAINT "rules_item_edition_id_pk" PRIMARY KEY("edition","id");
--> statement-breakpoint
ALTER TABLE "rules_keyword" ADD COLUMN "edition" text NOT NULL DEFAULT '1.0.2';
--> statement-breakpoint
ALTER TABLE "rules_keyword" ALTER COLUMN "edition" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rules_keyword" DROP CONSTRAINT "rules_keyword_pkey";
--> statement-breakpoint
ALTER TABLE "rules_keyword" ADD CONSTRAINT "rules_keyword_edition_name_pk" PRIMARY KEY("edition","name");
--> statement-breakpoint
ALTER TABLE "rules_patron" ADD COLUMN "edition" text NOT NULL DEFAULT '1.0.2';
--> statement-breakpoint
ALTER TABLE "rules_patron" ALTER COLUMN "edition" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rules_patron" DROP CONSTRAINT "rules_patron_pkey";
--> statement-breakpoint
ALTER TABLE "rules_patron" ADD CONSTRAINT "rules_patron_edition_id_pk" PRIMARY KEY("edition","id");
--> statement-breakpoint
ALTER TABLE "rules_table" ADD COLUMN "edition" text NOT NULL DEFAULT '1.0.2';
--> statement-breakpoint
ALTER TABLE "rules_table" ALTER COLUMN "edition" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rules_table" DROP CONSTRAINT "rules_table_pkey";
--> statement-breakpoint
ALTER TABLE "rules_table" ADD CONSTRAINT "rules_table_edition_id_pk" PRIMARY KEY("edition","id");
--> statement-breakpoint
ALTER TABLE "rules_unit" ADD COLUMN "edition" text NOT NULL DEFAULT '1.0.2';
--> statement-breakpoint
ALTER TABLE "rules_unit" ALTER COLUMN "edition" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "rules_unit" DROP CONSTRAINT "rules_unit_pkey";
--> statement-breakpoint
ALTER TABLE "rules_unit" ADD CONSTRAINT "rules_unit_edition_id_pk" PRIMARY KEY("edition","id");
--> statement-breakpoint
ALTER TABLE "rules_item" ADD COLUMN "sort" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "rules_unit" ADD COLUMN "sort" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "rules_version" ADD COLUMN "edition" text DEFAULT '1.0.2' NOT NULL;
--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "edition" text DEFAULT '1.0.2' NOT NULL;
--> statement-breakpoint
CREATE INDEX "rules_item_faction_idx" ON "rules_item" USING btree ("edition","faction");
--> statement-breakpoint
CREATE INDEX "rules_unit_faction_idx" ON "rules_unit" USING btree ("edition","faction");
