-- Step 3: the rules cache (rebuilt from the rules folders at start and on Reload, never edited) and each campaign's
-- rules version. Campaigns pin a core version; Carcass Front campaigns also play the Carcass Front expansion.
CREATE SCHEMA "rules";
--> statement-breakpoint
CREATE TABLE "rules"."edges" (
	"set_id" text NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "edges_set_id_from_id_to_id_kind_pk" PRIMARY KEY("set_id","from_id","to_id","kind"),
	CONSTRAINT "edges_kind" CHECK ("rules"."edges"."kind" in ('belongs_to', 'may_take', 'fixed_kit', 'has_keyword', 'has_upgrade', 'replaces', 'adds', 'excludes', 'counts_as', 'hires', 'serves', 'mentions', 'restricts'))
);
--> statement-breakpoint
CREATE TABLE "rules"."nodes" (
	"set_id" text NOT NULL,
	"id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	CONSTRAINT "nodes_set_id_id_pk" PRIMARY KEY("set_id","id")
);
--> statement-breakpoint
CREATE TABLE "rules"."sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"version" text,
	"base" text,
	"checksum" text NOT NULL,
	"report" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ok" boolean NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sets_kind" CHECK ("rules"."sets"."kind" in ('core', 'expansion', 'homebrew')),
	CONSTRAINT "sets_report_array" CHECK (jsonb_typeof("rules"."sets"."report") = 'array')
);
--> statement-breakpoint
ALTER TABLE "campaign"."campaigns" ADD COLUMN "rules_set" text DEFAULT 'core-1.0.2' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign"."campaigns" ADD COLUMN "rules_expansions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "rules"."edges" ADD CONSTRAINT "edges_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "rules"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules"."nodes" ADD CONSTRAINT "nodes_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "rules"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "edges_to_idx" ON "rules"."edges" USING btree ("set_id","to_id");--> statement-breakpoint
CREATE INDEX "nodes_name_idx" ON "rules"."nodes" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "nodes_type_idx" ON "rules"."nodes" USING btree ("set_id","type");--> statement-breakpoint
-- Existing Carcass Front campaigns play the Carcass Front expansion on top of the core rules.
UPDATE "campaign"."campaigns" SET "rules_expansions" = '{carcass-front-1.0}' WHERE "kind" = 'carcass_front';
