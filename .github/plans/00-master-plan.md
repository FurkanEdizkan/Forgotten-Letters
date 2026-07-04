# Forgotten Letters — Master Plan (Unified)

> Single source of truth for the build order and architecture. Each phase
> below has its own step-by-step file in `.github/plans/`. Tick boxes there
> as you work. These plan files supersede the earlier `.github/prompts/`
> exploratory drafts (now removed); architectural rationale that was useful
> from those drafts has been folded into the relevant phase files.

---

## Sprint Map

| Sprint | Theme                          | Phases                   | File                                                 |
| ------ | ------------------------------ | ------------------------ | ---------------------------------------------------- |
| 1      | Foundation                     | 1, G1, G2, G4            | `01-foundation.md`                                   |
| 2      | Data Layer                     | 2, B, F1, G3             | `02-data-layer.md`                                   |
| 3      | CMS & Content                  | 3, A, H1                 | `03-cms-and-content.md`                              |
| 4      | CRUD & Search                  | 4, C, H2, G5             | `04-crud-and-search.md`                              |
| 5      | Map Editor & Campaign          | 5/H3, D                  | `05-map-editor-and-campaign.md`                      |
| 6      | Social, Notifications, Reports | 6, E, F4, H4, **N1, N2** | `06-social-and-notifications.md`                     |
| 7      | Account, Admin, Monitoring     | 7, F2, F3, H5, **U1**    | `07-account-admin-monitoring.md`                     |
| 8      | Hardening & Launch Prep        | 8, F5, G6, H6, H7, **S1, S2** | `08-hardening-and-launch.md`                  |
| 9      | Launch & Post-Launch           | Cutover + v2 backlog     | `09-launch-and-post-launch.md`                       |

**Phase code legend** (codes preserved from the original planning drafts so
in-flight discussions remain searchable)

| Code      | Theme                                             |
| --------- | ------------------------------------------------- |
| 1–8       | Core TODO (bootstrap → polish & launch)           |
| A–E       | Warband builder & campaign tracker                |
| F1–F5     | Roles & admin dashboard                           |
| G1–G6     | CI/CD, git, testing                               |
| H1–H8     | Map editor, search, image pipeline, perf, legal   |
| **N, U, S** | **Gap-closing phases added during plan review** |

### New phases added to close gaps

| Phase | Title                                  | Gap it closes                                                       |
| ----- | -------------------------------------- | ------------------------------------------------------------------- |
| N1    | Email/Transactional Service            | No vendor chosen; auth emails un-customised                         |
| N2    | Notifications System (in-app + email)  | No bell, no schema, no preferences, no producer hooks               |
| U1    | User Data, GDPR & Onboarding           | No data export, no deletion cascade spec, no FTUE/empty states      |
| S1    | Markdown Pipeline + Anti-spam          | No markdown lib, no sanitiser, no CAPTCHA on public forms           |
| S2    | Backup, Recovery & Schema Reconcile    | No backup plan; cross-plan column drift (`play_count` etc.)         |

---

## Migration Order (single source of truth)

```
001_create_profiles.sql
002_create_game_systems.sql
003_create_campaigns.sql
004_create_scenarios.sql
005_create_scenario_sections.sql
006_create_event_tables.sql
007_create_uploaded_files.sql
008_create_votes.sql
009_create_favorites.sql
010_create_comments.sql
011_create_warband_tables.sql
012_add_roles_and_moderation.sql
013_create_storage_buckets.sql
014_add_search_indexes.sql
015_add_play_count_and_reconcile.sql   ← S2
016_create_notifications.sql           ← N2
017_create_contact_and_feedback.sql    ← U1
018_create_data_export_jobs.sql        ← U1
```

---

## Cross-cutting decisions baked into the unified plan

| Area                  | Choice                                              | Plan file                              |
| --------------------- | --------------------------------------------------- | -------------------------------------- |
| Email vendor          | **Resend** (free tier, React Email templates)       | `06-social-and-notifications.md` (N1)  |
| Notifications storage | Supabase `notifications` table + Realtime channel   | N2                                     |
| Markdown              | `react-markdown` + `rehype-sanitize` (allow-list)   | S1                                     |
| Anti-spam             | Cloudflare Turnstile (free, privacy-friendly)       | S1                                     |
| PDF export            | `@react-pdf/renderer` (server-side, watermark free) | `05-map-editor-and-campaign.md` (D)    |
| Data export           | Server action → background job → signed-URL ZIP     | U1                                     |
| Backups               | Supabase Pro daily + nightly `pg_dump` to S3        | S2                                     |
| i18n                  | **English only** for V1 (locked decision, recorded) | `00-master-plan.md`                    |
| Realtime              | Notifications + comments only (no map collab v1)    | N2 / Phase 6                           |
| shadcn ↔ palette      | Map grimdark tokens to shadcn `--primary` etc.      | Phase 1                                |

---

## How to use these plans

1. Work through `01-foundation.md` first; do not skip ahead.
2. Inside each sprint, do the items top-to-bottom unless the file marks an item `[parallel]`.
3. Each phase ends with a **Verify** block — do not advance until those pass.
4. When a step depends on a decision recorded above, link to it rather than re-deciding.
5. When you finish a sprint, mark it complete in `TODO.md` (the legacy checklist) and in this file's Sprint Map.

---

## Verification of completeness

This master plan covers, end-to-end:

- All eight original TODO phases (1–8)
- All four supplementary prompt plans (A–E, F1–F5, G1–G6, H1–H8)
- The five critical gap areas surfaced in review (N1, N2, U1, S1, S2)
- Cross-cutting decisions previously left implicit (email vendor, markdown lib,
  anti-spam, PDF tool, backup cadence, i18n posture, realtime scope,
  shadcn theming)

Anything not in this plan is explicitly **post-V1** and lives in
`09-launch-and-post-launch.md` under "v2 backlog".
