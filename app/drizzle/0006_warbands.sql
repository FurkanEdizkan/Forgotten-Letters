-- Steps 3-4: players' warbands (the warband schema: warbands and their fighters; the stash is JSONB on the warband),
-- a seat's warband (one campaign at a time: a warband sits in one seat at most) and the CM's "allow beyond limits".
-- Existing seats have no warband and existing campaigns keep their limits.
CREATE SCHEMA "warband";
--> statement-breakpoint
CREATE TYPE "warband"."fighter_group" AS ENUM('elite', 'troop', 'mercenary', 'special', 'dead');--> statement-breakpoint
CREATE TABLE "warband"."fighters" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"warband_id" uuid NOT NULL,
	"unit_id" text NOT NULL,
	"name" text,
	"grp" "warband"."fighter_group" NOT NULL,
	"kit" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"upgrades" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injuries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"image" text,
	"sort" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fighters_name_length" CHECK (char_length("warband"."fighters"."name") between 1 and 120),
	CONSTRAINT "fighters_xp_range" CHECK ("warband"."fighters"."xp" between 0 and 1000),
	CONSTRAINT "fighters_image_type" CHECK ("warband"."fighters"."image" in ('image/png', 'image/jpeg', 'image/webp')),
	CONSTRAINT "fighters_kit_array" CHECK (jsonb_typeof("warband"."fighters"."kit") = 'array')
);
--> statement-breakpoint
CREATE TABLE "warband"."warbands" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rules_set" text NOT NULL,
	"rules_expansions" text[] DEFAULT '{}'::text[] NOT NULL,
	"faction_id" text NOT NULL,
	"variant_id" text,
	"patron_id" text,
	"dedication" text,
	"ducat_limit" integer NOT NULL,
	"stash_ducats" integer DEFAULT 0 NOT NULL,
	"unspent_glory" integer DEFAULT 0 NOT NULL,
	"stash" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fireteams" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warbands_name_length" CHECK (char_length("warband"."warbands"."name") between 1 and 80),
	CONSTRAINT "warbands_ducat_limit_range" CHECK ("warband"."warbands"."ducat_limit" between 0 and 100000),
	CONSTRAINT "warbands_notes_length" CHECK (char_length("warband"."warbands"."notes") <= 4000),
	CONSTRAINT "warbands_stash_array" CHECK (jsonb_typeof("warband"."warbands"."stash") = 'array'),
	CONSTRAINT "warbands_fireteams_array" CHECK (jsonb_typeof("warband"."warbands"."fireteams") = 'array'),
	CONSTRAINT "warbands_locations_array" CHECK (jsonb_typeof("warband"."warbands"."locations") = 'array')
);
--> statement-breakpoint
ALTER TABLE "campaign"."campaigns" ADD COLUMN "allow_beyond_limits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign"."seats" ADD COLUMN "warband_id" uuid;--> statement-breakpoint
ALTER TABLE "warband"."fighters" ADD CONSTRAINT "fighters_warband_id_warbands_id_fk" FOREIGN KEY ("warband_id") REFERENCES "warband"."warbands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD CONSTRAINT "warbands_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fighters_warband_idx" ON "warband"."fighters" USING btree ("warband_id","sort");--> statement-breakpoint
CREATE INDEX "warbands_owner_idx" ON "warband"."warbands" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "campaign"."seats" ADD CONSTRAINT "seats_warband_id_warbands_id_fk" FOREIGN KEY ("warband_id") REFERENCES "warband"."warbands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seats_warband_key" ON "campaign"."seats" USING btree ("warband_id");--> statement-breakpoint
ALTER TABLE "campaign"."seats" ADD CONSTRAINT "seats_warband_with_user" CHECK ("campaign"."seats"."warband_id" is null or "campaign"."seats"."user_id" is not null);--> statement-breakpoint
CREATE TRIGGER warbands_set_updated_at BEFORE UPDATE ON warband.warbands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER fighters_set_updated_at BEFORE UPDATE ON warband.fighters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
