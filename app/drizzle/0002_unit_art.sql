CREATE TABLE "unit_art" (
	"campaign_id" text NOT NULL,
	"faction" text NOT NULL,
	"type_key" text NOT NULL,
	"type" text NOT NULL,
	"image" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "unit_art_campaign_id_faction_type_key_pk" PRIMARY KEY("campaign_id","faction","type_key")
);
--> statement-breakpoint
ALTER TABLE "unit_art" ADD CONSTRAINT "unit_art_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;