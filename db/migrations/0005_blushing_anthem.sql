CREATE TYPE "public"."battle_result" AS ENUM('win', 'loss', 'draw');--> statement-breakpoint
CREATE TABLE "battle_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"battleId" text NOT NULL,
	"userId" text,
	"displayName" text NOT NULL,
	"result" "battle_result" NOT NULL,
	"score" smallint
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"id" text PRIMARY KEY NOT NULL,
	"campaignId" text NOT NULL,
	"scenarioId" text,
	"recordedById" text NOT NULL,
	"playedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battleId_battles_id_fk" FOREIGN KEY ("battleId") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_scenarioId_scenarios_id_fk" FOREIGN KEY ("scenarioId") REFERENCES "public"."scenarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_recordedById_users_id_fk" FOREIGN KEY ("recordedById") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "battle_participants_battle_idx" ON "battle_participants" USING btree ("battleId");--> statement-breakpoint
CREATE INDEX "battles_campaign_idx" ON "battles" USING btree ("campaignId","playedAt");--> statement-breakpoint
CREATE INDEX "battles_scenario_idx" ON "battles" USING btree ("scenarioId");