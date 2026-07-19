ALTER TABLE "users" ADD COLUMN "totpSecret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totpConfirmedAt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totpRecoveryCodes" text[];