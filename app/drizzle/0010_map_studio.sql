CREATE TABLE "map_zone" (
	"campaign_id" text NOT NULL,
	"id" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"zone" jsonb NOT NULL,
	CONSTRAINT "map_zone_campaign_id_id_pk" PRIMARY KEY("campaign_id","id")
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "map_image" text;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "map_width" integer;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "map_height" integer;--> statement-breakpoint
ALTER TABLE "map_zone" ADD CONSTRAINT "map_zone_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;