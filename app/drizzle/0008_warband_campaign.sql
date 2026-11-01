CREATE TYPE "warband"."fighter_status" AS ENUM('active', 'misses_next', 'captured', 'unfit', 'retired', 'dead');--> statement-breakpoint
ALTER TABLE "warband"."fighters" ADD COLUMN "status" "warband"."fighter_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "warband"."fighters" ADD COLUMN "battle_scars" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD COLUMN "games_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD COLUMN "victory_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD COLUMN "failed_promotions" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD COLUMN "ignore_limits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warband"."fighters" ADD CONSTRAINT "fighters_scars_range" CHECK ("warband"."fighters"."battle_scars" between 0 and 10);--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD CONSTRAINT "warbands_games_range" CHECK ("warband"."warbands"."games_played" between 0 and 100);--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD CONSTRAINT "warbands_vp_range" CHECK ("warband"."warbands"."victory_points" between -1000 and 1000);--> statement-breakpoint
ALTER TABLE "warband"."warbands" ADD CONSTRAINT "warbands_failed_promotions_range" CHECK ("warband"."warbands"."failed_promotions" between 0 and 100);--> statement-breakpoint
-- Fighters in the old Dead group are dead; status now drives the Dead list (the group value stays, it is unknown).
UPDATE "warband"."fighters" SET "status" = 'dead' WHERE "grp" = 'dead';--> statement-breakpoint
-- The Court's Sins are a dedication on the warband, no longer a variant (review decision R2).
UPDATE "warband"."warbands" SET "dedication" = substring("variant_id" from '^variant:seven-headed-serpent/(.+)$'), "variant_id" = NULL WHERE "variant_id" LIKE 'variant:seven-headed-serpent/%';
