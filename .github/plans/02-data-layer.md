# Sprint 2 — Data Layer

> Goal: every table, RLS policy, trigger, storage bucket, and CI workflow that
> later sprints depend on. After this sprint the database is schema-complete
> for V1; we only add **search indexes** (H2) and **notifications** (N2) later.
>
> Phases included: **2, B, F1, G3**.

---

## Phase 2 — Core schema

### 2.1 Migrations 001–010

Write migrations one file per table; each includes table + indexes + RLS in
the same file.

- [ ] `001_create_profiles.sql` — id FK auth.users, username UNIQUE, display_name, avatar_url, bio, total_storage_used_bytes default 0, is_premium default false, timestamps
- [ ] `002_create_game_systems.sql` — id, name, slug UNIQUE, description, icon_url, created_at
- [ ] `003_create_campaigns.sql` — id, author_id, game_system_id, title, slug UNIQUE, description, cover_image_url, is_published, is_official, timestamps
- [ ] `004_create_scenarios.sql` — adds `play_count integer default 0` upfront (closes the H2 search-sort gap, see S2)
- [ ] `005_create_scenario_sections.sql` — section_type enum, title, content jsonb, sort_order
- [ ] `006_create_event_tables.sql` — title, description, entries jsonb
- [ ] `007_create_uploaded_files.sql` — user_id, scenario_id NULL, storage_path, file_name, file_size_bytes, mime_type, is_temporary default true, created_at
- [ ] `008_create_votes.sql` — target_type enum, value SMALLINT CHECK -1/+1, UNIQUE(user_id, target_type, target_id)
- [ ] `009_create_favorites.sql` — UNIQUE(user_id, target_type, target_id)
- [ ] `010_create_comments.sql` — parent_id self-FK NULL, body TEXT, timestamps

### 2.2 Triggers & functions

- [ ] `handle_new_user()` AFTER INSERT on `auth.users` → insert profile row
- [ ] `check_user_storage_quota(user_id, new_size)` returns boolean (50 MB free / 500 MB premium)
- [ ] `update_storage_used()` BEFORE INSERT/AFTER DELETE on `uploaded_files`
- [ ] `get_vote_count(target_type, target_id)` returns integer
- [ ] `increment_play_count(scenario_id)` — called from match logging (Sprint 5)

### 2.3 RLS policies

- [ ] profiles: read all, update own
- [ ] game_systems: read all, write service_role only
- [ ] campaigns: read where `is_published`, owner CRUD, service_role for `is_official`
- [ ] scenarios: read where `is_published`, owner CRUD
- [ ] scenario_sections / event_tables: follow parent
- [ ] uploaded_files: owner read/delete, insert with quota check
- [ ] votes / favorites: auth'd insert/delete own; votes readable by all, favorites readable by owner
- [ ] comments: read all, auth'd insert, owner update/delete

### 2.4 Storage buckets — `013_create_storage_buckets.sql`

- [ ] `scenario-assets` (public read, auth write, 5 MB cap, mime allow-list)
- [ ] `avatars` (public read, auth write, 2 MB cap)
- [ ] Bucket policies mirror RLS

### 2.5 Seed

- [ ] `supabase/seed/001_game_systems.sql` — Trench Crusade row
- [ ] `supabase db reset` runs cleanly locally

### 2.6 Type generation

- [ ] `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
- [ ] Add `db:types` script to `package.json`

### 2.7 Verify Phase 2

- [ ] Register a user → row appears in `profiles`
- [ ] Anonymous SELECT on `game_systems` returns the seed row
- [ ] User A can't UPDATE user B's scenario (RLS denies)
- [ ] Anonymous can't read unpublished scenarios
- [ ] Upload increments `total_storage_used_bytes`; over-quota upload rejected

---

## Phase B — Warband tables

### B.1 Migration `011_create_warband_tables.sql`

- [ ] `warbands` — author_id, game_system_id, name, faction_slug, rules_version, total_points default 0, max_points default 1000, is_public default false, is_campaign default false, notes, timestamps
- [ ] `warband_units` — warband_id ON DELETE CASCADE, unit_slug, custom_name, equipment_slugs text[], computed_cost, position, created_at
- [ ] `campaign_state` — UNIQUE warband_id; W/L/D, treasury, glory_points
- [ ] `unit_campaign_progress` — warband_unit_id FK CASCADE, experience, advancements jsonb, injuries jsonb, is_dead, kills, matches_played
- [ ] `matches` — warband_id, scenario_id NULL, opponent_name, opponent_warband_id NULL, result CHECK in (win/loss/draw), date_played, notes, glory_earned, ducats_earned

### B.2 Triggers & checks

- [ ] `check_warband_limit()` BEFORE INSERT on `warbands` — 5 free / 20 premium
- [ ] `recalculate_warband_points(warband_id)` helper
- [ ] On `matches` INSERT with non-null `scenario_id` → call `increment_play_count(scenario_id)`

### B.3 RLS

- [ ] `warbands`: owner CRUD; SELECT also allowed where `is_public = true`
- [ ] `warband_units`, `campaign_state`, `unit_campaign_progress`: follow parent warband
- [ ] `matches`: owner CRUD; SELECT also allowed where parent warband `is_public`

### B.4 Indexes

- [ ] `warbands(author_id)`, `warbands(game_system_id, is_public)`
- [ ] `matches(warband_id, date_played DESC)`
- [ ] `warband_units(warband_id)`

### B.5 Verify

- [ ] 6th warband insert for a free user fails the limit trigger
- [ ] Logging a match with `scenario_id` increments the linked scenario's `play_count`
- [ ] User A can SELECT user B's `is_public = true` warband but not their private one

---

## Phase F1 — Roles & moderation tables

### F1.1 Migration `012_add_roles_and_moderation.sql`

- [ ] `profiles` add: `role text default 'user' CHECK in ('admin','co_admin','user')`, `is_banned`, `banned_at`, `banned_by`, `ban_reason`
- [ ] `scenarios` add: `is_hidden`, `is_featured`
- [ ] `campaigns`, `comments`, `warbands` add: `is_hidden`
- [ ] Create `reports` table — id, reporter_id FK profiles, target_type CHECK in (`scenario`,`campaign`,`comment`,`warband`,`profile`), target_id uuid, reason CHECK in (`spam`,`offensive`,`copyright`,`harassment`,`other`), details, status default `pending` CHECK in (`pending`,`resolved`,`dismissed`), resolved_by FK profiles NULL, resolved_at, resolution_note, created_at; **UNIQUE(reporter_id, target_type, target_id)**
- [ ] Create `moderation_actions` audit table — id, admin_id FK profiles, action_type CHECK in (`ban`,`unban`,`hide_content`,`unhide_content`,`feature`,`unfeature`,`resolve_report`,`dismiss_report`,`change_role`,`delete_user`), target_type, target_id, reason, metadata jsonb, created_at

### F1.2 RLS

- [ ] Only admin can UPDATE `profiles.role`
- [ ] Reports: any auth'd can INSERT; only admin/co_admin SELECT/UPDATE
- [ ] `moderation_actions`: admin/co_admin INSERT; admin SELECT all, co_admin SELECT own
- [ ] Public-facing browse queries enforce `is_hidden = false` (handled in app code; double-protected by RLS view added later)

### F1.3 Triggers

- [ ] Auto-set `banned_at` and `banned_by` when `is_banned` flips to true
- [ ] Prevent self-banning, prevent banning admins (admin role only)

### F1.4 Indexes

- [ ] `reports(status, created_at DESC)`
- [ ] `reports(target_type, target_id)`
- [ ] `moderation_actions(admin_id, created_at DESC)`
- [ ] `profiles(role)`

### F1.5 Verify

- [ ] Insert a duplicate report from same user → unique violation
- [ ] Non-admin attempt to set `profiles.role` rejected by RLS

---

## Phase G3 — GitHub Actions workflows (parallel)

- [ ] `.github/workflows/ci.yml` — lint + typecheck + test (with coverage report) + build
- [ ] `.github/workflows/e2e.yml` — Playwright on PRs to `main`
- [ ] `.github/workflows/commitlint.yml` — PR title check
- [ ] `.github/workflows/release.yml` — semantic-release on `main` push
- [ ] `.github/workflows/db-migration-check.yml` — `supabase db lint` + `supabase db diff --linked` on `supabase/migrations/**` changes
- [ ] Add `npm audit --audit-level=critical` step to `ci.yml`
- [ ] Add CodeQL analysis step

---

## Sprint 2 — Verify

- [ ] All migrations 001–013 apply cleanly to a fresh DB (`supabase db reset`)
- [ ] Generated types compile against project (`tsc --noEmit`)
- [ ] CI runs all five workflows on a sample PR; migration-check workflow fires when SQL changes
- [ ] Local seed produces a Trench Crusade game system + an admin profile (use `supabase/seed/002_admin_user.sql` keyed off env var email)
