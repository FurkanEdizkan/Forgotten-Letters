-- Steps 3-4: homebrew (the homebrew schema: player-made rules sets, private until shared, with the current draft's
-- check report and the last version that passed) and the homebrew sets a campaign allows. Existing campaigns allow
-- none.
CREATE SCHEMA "homebrew";
--> statement-breakpoint
CREATE TYPE "homebrew"."kind" AS ENUM('faction', 'variant', 'items');--> statement-breakpoint
CREATE TYPE "homebrew"."visibility" AS ENUM('private', 'shared');--> statement-breakpoint
CREATE TABLE "homebrew"."homebrew_sets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "homebrew"."kind" NOT NULL,
	"base_set" text NOT NULL,
	"visibility" "homebrew"."visibility" DEFAULT 'private' NOT NULL,
	"data" jsonb NOT NULL,
	"copied_from" text,
	"report" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_good" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homebrew_sets_name_length" CHECK (char_length("homebrew"."homebrew_sets"."name") between 1 and 80),
	CONSTRAINT "homebrew_sets_data_object" CHECK (jsonb_typeof("homebrew"."homebrew_sets"."data") = 'object'),
	CONSTRAINT "homebrew_sets_report_array" CHECK (jsonb_typeof("homebrew"."homebrew_sets"."report") = 'array')
);
--> statement-breakpoint
ALTER TABLE "campaign"."campaigns" ADD COLUMN "homebrew_sets" uuid[] DEFAULT '{}'::uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "homebrew"."homebrew_sets" ADD CONSTRAINT "homebrew_sets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "homebrew_sets_owner_idx" ON "homebrew"."homebrew_sets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "homebrew_sets_base_idx" ON "homebrew"."homebrew_sets" USING btree ("base_set");--> statement-breakpoint
CREATE TRIGGER homebrew_sets_set_updated_at BEFORE UPDATE ON homebrew.homebrew_sets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
