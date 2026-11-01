ALTER TABLE "campaign"."seat_invites" ALTER COLUMN "expires_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "campaign"."seat_invites" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign"."seat_invites" ADD COLUMN "token_enc" text;--> statement-breakpoint
ALTER TABLE "campaign"."seat_invites" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
-- House rules saved before the library become the CM's own: passive, no preset, no values.
UPDATE "campaign"."campaigns"
SET "house_rules" = (
	SELECT coalesce(jsonb_agg('{"kind":"passive","preset":null,"values":{}}'::jsonb || r), '[]'::jsonb)
	FROM jsonb_array_elements("house_rules") AS r
)
WHERE jsonb_array_length("house_rules") > 0;
