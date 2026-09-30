CREATE TABLE "account_request" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"password_hash" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_request_kind_username_idx" ON "account_request" USING btree ("kind","username");