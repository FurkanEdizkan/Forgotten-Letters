CREATE TABLE "adjustment" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"warband_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb,
	"note" text,
	"committed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"games_per_player" integer DEFAULT 8 NOT NULL,
	"expected_players" integer DEFAULT 8 NOT NULL,
	"random_scenario_turns" integer DEFAULT 4 NOT NULL,
	"glory_scoring" text DEFAULT 'boxIndex' NOT NULL,
	"house_zones" boolean DEFAULT true NOT NULL,
	"house_razing" boolean DEFAULT false NOT NULL,
	"house_outpost_levy" boolean DEFAULT false NOT NULL,
	"visions_revealed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_state" (
	"campaign_id" text PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"zone" text NOT NULL,
	"aggressor_id" text NOT NULL,
	"defender_id" text NOT NULL,
	"winner_id" text,
	"scenario" text,
	"weather_event" integer,
	"weather_rolls" jsonb,
	"result" jsonb,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"kind" text NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" text NOT NULL,
	"stl" text,
	"token" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"seat" integer,
	"name" text NOT NULL,
	"portrait" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "region_weather" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text,
	"zones" jsonb,
	"weather_event" integer,
	"fx" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"games_remaining" integer,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"warband_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'troop' NOT NULL,
	"leader" boolean DEFAULT false NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'ducats' NOT NULL,
	"experience" integer DEFAULT 0 NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"upgrades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injuries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"photo" text,
	"status" text DEFAULT 'active' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warband" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"player_id" text NOT NULL,
	"name" text NOT NULL,
	"faction" text NOT NULL,
	"variant" text,
	"patron" text,
	"symbol" text,
	"entry_zone" text NOT NULL,
	"vision_card" text,
	"vision_progress" integer DEFAULT 0 NOT NULL,
	"vision_notes" text,
	"treasury_ducats" integer DEFAULT 0 NOT NULL,
	"treasury_glory" integer DEFAULT 0 NOT NULL,
	"roster_notes" text,
	"display_model" text DEFAULT 'portrait' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warband_stash" (
	"id" text PRIMARY KEY NOT NULL,
	"warband_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'equipment' NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'ducats' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_lore" (
	"campaign_id" text NOT NULL,
	"zone_id" text NOT NULL,
	"lore" text DEFAULT '' NOT NULL,
	"image" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "zone_lore_campaign_id_zone_id_pk" PRIMARY KEY("campaign_id","zone_id")
);
--> statement-breakpoint
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment" ADD CONSTRAINT "adjustment_warband_id_warband_id_fk" FOREIGN KEY ("warband_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_state" ADD CONSTRAINT "fx_state_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_aggressor_id_warband_id_fk" FOREIGN KEY ("aggressor_id") REFERENCES "public"."warband"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_defender_id_warband_id_fk" FOREIGN KEY ("defender_id") REFERENCES "public"."warband"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_winner_id_warband_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."warband"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player" ADD CONSTRAINT "player_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region_weather" ADD CONSTRAINT "region_weather_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_warband_id_warband_id_fk" FOREIGN KEY ("warband_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warband" ADD CONSTRAINT "warband_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warband" ADD CONSTRAINT "warband_player_id_player_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."player"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warband_stash" ADD CONSTRAINT "warband_stash_warband_id_warband_id_fk" FOREIGN KEY ("warband_id") REFERENCES "public"."warband"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_lore" ADD CONSTRAINT "zone_lore_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adjustment_campaign_idx" ON "adjustment" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "game_campaign_idx" ON "game" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "model_owner_idx" ON "model" USING btree ("campaign_id","kind","owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "player_campaign_idx" ON "player" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "unit_warband_idx" ON "unit" USING btree ("warband_id");--> statement-breakpoint
CREATE INDEX "warband_campaign_idx" ON "warband" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "stash_warband_idx" ON "warband_stash" USING btree ("warband_id");