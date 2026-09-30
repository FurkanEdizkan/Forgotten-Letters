CREATE TABLE "round" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"number" integer NOT NULL,
	"step" text DEFAULT 'rolling' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "round_entry" (
	"round_id" text NOT NULL,
	"warband_id" text NOT NULL,
	"aggressions" integer DEFAULT 0 NOT NULL,
	"rolls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"role" text,
	"pick_order" integer,
	CONSTRAINT "round_entry_round_id_warband_id_pk" PRIMARY KEY("round_id","warband_id")
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "round_id" text;--> statement-breakpoint
ALTER TABLE "round" ADD CONSTRAINT "round_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_entry" ADD CONSTRAINT "round_entry_round_id_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_entry" ADD CONSTRAINT "round_entry_warband_id_warband_id_fk" FOREIGN KEY ("warband_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "round_campaign_number_idx" ON "round" USING btree ("campaign_id","number");--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_round_id_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."round"("id") ON DELETE set null ON UPDATE no action;