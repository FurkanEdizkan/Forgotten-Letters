-- Hand-written data statement (decision 80): a copy keeps exactly one Owner. The oldest Owner that is not
-- anonymised stays, an active one before a disabled one (the recovery script can enable it); with every Owner
-- anonymised, the oldest still stays, so a copy never ends up with no Owner. Every other Owner becomes an Admin,
-- with a version bump and an audit row (no actor: the upgrade did it).
WITH "keep" AS (
	SELECT "id" FROM "auth"."users"
	WHERE "role" = 'owner'
	ORDER BY ("anonymised_at" IS NULL) DESC, ("disabled_at" IS NULL) DESC, "created_at", "id"
	LIMIT 1
), "demoted" AS (
	UPDATE "auth"."users" SET "role" = 'admin', "version" = "version" + 1, "updated_at" = now()
	WHERE "role" = 'owner' AND "id" NOT IN (SELECT "id" FROM "keep")
	RETURNING "id"
)
INSERT INTO "auth"."audit_log" ("action", "target_type", "target_id", "detail")
SELECT 'role.changed', 'user', "id"::text, '{"from":"owner","to":"admin","reason":"single_owner"}'::jsonb
FROM "demoted";--> statement-breakpoint
-- Generated: the database refuses a second Owner from now on.
CREATE UNIQUE INDEX "users_one_owner" ON "auth"."users" USING btree ("role") WHERE "auth"."users"."role" = 'owner';
