CREATE TABLE "rules_faction" (
	"id" text PRIMARY KEY NOT NULL,
	"faction" text NOT NULL,
	"variant" text,
	"text" text NOT NULL,
	"page" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "unit" ALTER COLUMN "campaign_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "warband" ALTER COLUMN "campaign_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "warband" ALTER COLUMN "player_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "warband" ALTER COLUMN "entry_zone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "list_owner_id" text;--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "open_exploration" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "fireteams" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "lore" text;--> statement-breakpoint
ALTER TABLE "warband" ADD CONSTRAINT "warband_list_owner_id_user_id_fk" FOREIGN KEY ("list_owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;