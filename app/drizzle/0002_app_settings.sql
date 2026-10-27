CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"text_scale" smallint DEFAULT 100 NOT NULL,
	"accent" text DEFAULT 'blood' NOT NULL,
	"port" integer DEFAULT 3000 NOT NULL,
	"setup_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "settings_single_row" CHECK ("app"."settings"."id" = 1),
	CONSTRAINT "settings_text_scale_range" CHECK ("app"."settings"."text_scale" between 90 and 130 and "app"."settings"."text_scale" % 5 = 0),
	CONSTRAINT "settings_accent_preset" CHECK ("app"."settings"."accent" in ('blood', 'brass', 'verdigris', 'bruise', 'ash')),
	CONSTRAINT "settings_port_range" CHECK ("app"."settings"."port" between 1024 and 65535)
);
--> statement-breakpoint
DROP TABLE "auth"."setup_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Hand-written data statements. The one settings row exists from the start, so code only ever updates it.
INSERT INTO "app"."settings" ("id") VALUES (1);--> statement-breakpoint
-- A copy that already has an owner (set up through the old setup link) counts as set up.
UPDATE "app"."settings" SET "setup_completed_at" = now() WHERE EXISTS (SELECT 1 FROM "auth"."users" WHERE "role" = 'owner');--> statement-breakpoint
CREATE TRIGGER settings_set_updated_at BEFORE UPDATE ON "app"."settings" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
