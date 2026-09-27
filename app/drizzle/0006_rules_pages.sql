CREATE TABLE "rules_page" (
	"slug" text PRIMARY KEY NOT NULL,
	"book" text NOT NULL,
	"chapter" text NOT NULL,
	"title" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"source" text,
	"page" text,
	"verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warband" ADD COLUMN "unrestricted" boolean DEFAULT false NOT NULL;