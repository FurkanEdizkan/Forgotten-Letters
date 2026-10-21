CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TYPE "auth"."invite_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "auth"."role" AS ENUM('owner', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "auth"."audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auth"."audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"detail" jsonb,
	"ip" text,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE "auth"."invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token_hash" text NOT NULL,
	"role" "auth"."invite_role" NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"remember" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."setup_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "auth"."role" DEFAULT 'user' NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"anonymised_at" timestamp with time zone,
	"invited_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_form" CHECK ("auth"."users"."username" ~ '^[a-z0-9._-]{3,32}$'),
	CONSTRAINT "users_display_name_length" CHECK (char_length("auth"."users"."display_name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "auth"."audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."invites" ADD CONSTRAINT "invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."users" ADD CONSTRAINT "users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "auth"."audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_at_idx" ON "auth"."audit_log" USING btree ("actor_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_key" ON "auth"."invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "invites_created_by_idx" ON "auth"."invites" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "invites_open_idx" ON "auth"."invites" USING btree ("expires_at") WHERE "auth"."invites"."used_at" is null and "auth"."invites"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "auth"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "setup_tokens_token_key" ON "auth"."setup_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "auth"."users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "auth"."users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_invited_by_idx" ON "auth"."users" USING btree ("invited_by");