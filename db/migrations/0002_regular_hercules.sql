CREATE TYPE "public"."forge_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."section_type" AS ENUM('narrative', 'objectives', 'deployment', 'special_rules', 'victory_conditions', 'event_table', 'aftermath');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('conscript', 'veteran', 'cartographer');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('scenario', 'campaign', 'warband', 'comment');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" text NOT NULL,
	"gameSystemId" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"graph" jsonb,
	"isPublished" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" text NOT NULL,
	"targetType" "target_type" NOT NULL,
	"targetId" text NOT NULL,
	"parentId" text,
	"body" text NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"userId" text PRIMARY KEY NOT NULL,
	"adsDisabled" boolean DEFAULT false NOT NULL,
	"storageQuotaBytes" bigint DEFAULT 52428800 NOT NULL,
	"forgeCredits" integer DEFAULT 0 NOT NULL,
	"privateCampaigns" boolean DEFAULT false NOT NULL,
	"isSupporter" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"scenarioId" text NOT NULL,
	"title" text NOT NULL,
	"diceNotation" text DEFAULT 'd6' NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"targetType" "target_type" NOT NULL,
	"targetId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_target_unq" UNIQUE("userId","targetType","targetId")
);
--> statement-breakpoint
CREATE TABLE "forge_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"prompt" text NOT NULL,
	"provider" text NOT NULL,
	"sourceAssetKey" text,
	"outputImageKey" text,
	"outputMeshKey" text,
	"status" "forge_job_status" DEFAULT 'queued' NOT NULL,
	"creditsSpent" integer DEFAULT 0 NOT NULL,
	"error" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "game_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"publisher" text,
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_systems_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scenario_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"scenarioId" text NOT NULL,
	"type" "section_type" NOT NULL,
	"heading" text,
	"body" text,
	"position" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" text NOT NULL,
	"gameSystemId" text NOT NULL,
	"campaignId" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"playerCount" smallint,
	"estimatedMinutes" smallint,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"mapData" jsonb,
	"isPublished" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"tier" "subscription_tier" DEFAULT 'conscript' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"currentPeriodEnd" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"bucket" text NOT NULL,
	"objectKey" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" bigint NOT NULL,
	"isTemporary" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"targetType" "target_type" NOT NULL,
	"targetId" text NOT NULL,
	"value" smallint NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_user_target_unq" UNIQUE("userId","targetType","targetId")
);
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "storageUsedBytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_authorId_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_gameSystemId_game_systems_id_fk" FOREIGN KEY ("gameSystemId") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_comments_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_scenarioId_scenarios_id_fk" FOREIGN KEY ("scenarioId") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forge_jobs" ADD CONSTRAINT "forge_jobs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_sections" ADD CONSTRAINT "scenario_sections_scenarioId_scenarios_id_fk" FOREIGN KEY ("scenarioId") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_authorId_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_gameSystemId_game_systems_id_fk" FOREIGN KEY ("gameSystemId") REFERENCES "public"."game_systems"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_campaignId_campaigns_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_author_slug_idx" ON "campaigns" USING btree ("authorId","slug");--> statement-breakpoint
CREATE INDEX "campaigns_author_idx" ON "campaigns" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "campaigns_published_idx" ON "campaigns" USING btree ("isPublished");--> statement-breakpoint
CREATE INDEX "campaigns_created_idx" ON "campaigns" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "comments" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "event_tables_scenario_idx" ON "event_tables" USING btree ("scenarioId");--> statement-breakpoint
CREATE INDEX "favorites_target_idx" ON "favorites" USING btree ("targetType","targetId");--> statement-breakpoint
CREATE INDEX "favorites_user_idx" ON "favorites" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "forge_jobs_user_idx" ON "forge_jobs" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "forge_jobs_status_idx" ON "forge_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_systems_slug_idx" ON "game_systems" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "scenario_sections_scenario_idx" ON "scenario_sections" USING btree ("scenarioId","position");--> statement-breakpoint
CREATE UNIQUE INDEX "scenarios_author_slug_idx" ON "scenarios" USING btree ("authorId","slug");--> statement-breakpoint
CREATE INDEX "scenarios_author_idx" ON "scenarios" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "scenarios_campaign_idx" ON "scenarios" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "scenarios_published_idx" ON "scenarios" USING btree ("isPublished");--> statement-breakpoint
CREATE INDEX "scenarios_created_idx" ON "scenarios" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "scenarios_system_idx" ON "scenarios" USING btree ("gameSystemId");--> statement-breakpoint
CREATE INDEX "subscriptions_customer_idx" ON "subscriptions" USING btree ("stripeCustomerId");--> statement-breakpoint
CREATE INDEX "subscriptions_subscription_idx" ON "subscriptions" USING btree ("stripeSubscriptionId");--> statement-breakpoint
CREATE UNIQUE INDEX "uploaded_files_bucket_key_idx" ON "uploaded_files" USING btree ("bucket","objectKey");--> statement-breakpoint
CREATE INDEX "uploaded_files_user_idx" ON "uploaded_files" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "uploaded_files_temp_idx" ON "uploaded_files" USING btree ("isTemporary","createdAt");--> statement-breakpoint
CREATE INDEX "votes_target_idx" ON "votes" USING btree ("targetType","targetId");