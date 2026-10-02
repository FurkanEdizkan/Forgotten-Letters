CREATE TABLE "aftermath_report" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"warband_id" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"lines" jsonb NOT NULL,
	"reply" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules_table" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"dice" text DEFAULT 'D6' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb,
	"source" text,
	"verified" boolean DEFAULT false NOT NULL,
	"origin" text DEFAULT 'book' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "promotion_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "aftermath_report" ADD CONSTRAINT "aftermath_report_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aftermath_report" ADD CONSTRAINT "aftermath_report_warband_id_warband_id_fk" FOREIGN KEY ("warband_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "aftermath_game_warband" ON "aftermath_report" USING btree ("game_id","warband_id");