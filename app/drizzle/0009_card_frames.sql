CREATE TABLE "warband"."card_frames" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"target" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_frames_target_unique" UNIQUE("target"),
	CONSTRAINT "card_frames_target_length" CHECK (char_length("warband"."card_frames"."target") between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "warband"."card_frames" ADD CONSTRAINT "card_frames_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;