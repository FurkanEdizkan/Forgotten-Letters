CREATE TABLE "profiles" (
	"userId" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"displayName" text,
	"bio" text,
	"avatarKey" text,
	"storageUsedBytes" integer DEFAULT 0 NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "passwordHash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "createdAt" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_username_idx" ON "profiles" USING btree ("username");