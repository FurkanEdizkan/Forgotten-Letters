CREATE SCHEMA "campaign";
--> statement-breakpoint
CREATE TYPE "campaign"."kind" AS ENUM('carcass_front', 'generic');--> statement-breakpoint
CREATE TYPE "campaign"."member_role" AS ENUM('cm', 'co_cm');--> statement-breakpoint
CREATE TYPE "campaign"."request_status" AS ENUM('open', 'approved', 'declined', 'withdrawn');--> statement-breakpoint
CREATE TYPE "campaign"."stage" AS ENUM('mustering', 'active', 'ended');--> statement-breakpoint
CREATE TYPE "campaign"."visibility" AS ENUM('listed', 'private');--> statement-breakpoint
CREATE TABLE "campaign"."campaigns" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"kind" "campaign"."kind" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stage" "campaign"."stage" DEFAULT 'mustering' NOT NULL,
	"visibility" "campaign"."visibility" NOT NULL,
	"games_per_player" smallint,
	"starts_on" date,
	"ends_on" date,
	"house_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_name_length" CHECK (char_length("campaign"."campaigns"."name") between 1 and 80),
	CONSTRAINT "campaigns_description_length" CHECK (char_length("campaign"."campaigns"."description") <= 500),
	CONSTRAINT "campaigns_games_per_player_range" CHECK ("campaign"."campaigns"."games_per_player" between 1 and 50),
	CONSTRAINT "campaigns_dates_in_order" CHECK ("campaign"."campaigns"."ends_on" >= "campaign"."campaigns"."starts_on"),
	CONSTRAINT "campaigns_house_rules_array" CHECK (jsonb_typeof("campaign"."campaigns"."house_rules") = 'array')
);
--> statement-breakpoint
CREATE TABLE "campaign"."join_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" "campaign"."request_status" DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign"."members" (
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "campaign"."member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "campaign"."seat_invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"seat_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '7 days' NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign"."seats" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"number" smallint NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"joined_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seats_name_length" CHECK (char_length("campaign"."seats"."name") between 1 and 40),
	CONSTRAINT "seats_joined_with_user" CHECK (("campaign"."seats"."user_id" is null) = ("campaign"."seats"."joined_at" is null))
);
--> statement-breakpoint
ALTER TABLE "campaign"."campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."join_requests" ADD CONSTRAINT "join_requests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaign"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."join_requests" ADD CONSTRAINT "join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."join_requests" ADD CONSTRAINT "join_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."members" ADD CONSTRAINT "members_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaign"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."seat_invites" ADD CONSTRAINT "seat_invites_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "campaign"."seats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."seat_invites" ADD CONSTRAINT "seat_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."seat_invites" ADD CONSTRAINT "seat_invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."seats" ADD CONSTRAINT "seats_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaign"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign"."seats" ADD CONSTRAINT "seats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_name_key" ON "campaign"."campaigns" USING btree (lower("name")) WHERE "campaign"."campaigns"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "campaigns_deleted_idx" ON "campaign"."campaigns" USING btree ("deleted_at") WHERE "campaign"."campaigns"."deleted_at" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_one_open_key" ON "campaign"."join_requests" USING btree ("campaign_id","user_id") WHERE "campaign"."join_requests"."status" = 'open';--> statement-breakpoint
CREATE INDEX "join_requests_user_idx" ON "campaign"."join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_one_cm_key" ON "campaign"."members" USING btree ("campaign_id") WHERE "campaign"."members"."role" = 'cm';--> statement-breakpoint
CREATE INDEX "members_user_idx" ON "campaign"."members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seat_invites_token_key" ON "campaign"."seat_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "seat_invites_open_idx" ON "campaign"."seat_invites" USING btree ("seat_id") WHERE "campaign"."seat_invites"."used_at" is null and "campaign"."seat_invites"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "seats_number_key" ON "campaign"."seats" USING btree ("campaign_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "seats_one_per_person_key" ON "campaign"."seats" USING btree ("campaign_id","user_id") WHERE "campaign"."seats"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "seats_user_idx" ON "campaign"."seats" USING btree ("user_id");--> statement-breakpoint
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON campaign.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER members_set_updated_at BEFORE UPDATE ON campaign.members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER seats_set_updated_at BEFORE UPDATE ON campaign.seats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER join_requests_set_updated_at BEFORE UPDATE ON campaign.join_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
