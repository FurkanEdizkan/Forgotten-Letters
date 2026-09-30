CREATE TABLE "challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"round_id" text,
	"aggressor_id" text NOT NULL,
	"defender_id" text NOT NULL,
	"zone" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"game_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "pass_penalty" jsonb DEFAULT '{"cvp":0,"glory":0,"ducats":0,"boxes":{}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "round_entry" ADD COLUMN "player_round" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_round_id_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_aggressor_id_warband_id_fk" FOREIGN KEY ("aggressor_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_defender_id_warband_id_fk" FOREIGN KEY ("defender_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_campaign_idx" ON "challenge" USING btree ("campaign_id","status");