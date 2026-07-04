# Sprint 7 — Account, Admin, Monitoring, User Data

> Goal: a user can fully manage their account (profile, security, storage,
> data export, deletion), an admin/co_admin can moderate content + users,
> and we have observability before launch.
>
> Phases included: **7, F2, F3, H5, U1** (U1 is a gap-closing phase — see
> `00-master-plan.md`).

---

## Phase 7 — Account management

### 7.1 Settings shell

- [ ] `src/app/(protected)/settings/layout.tsx` — sidebar (Profile / Account / Storage / Notifications / Privacy)
- [ ] `src/app/(protected)/settings/profile/page.tsx` — display name, username, bio, avatar upload (uses H1 pipeline)

### 7.2 Account

- [ ] `src/app/(protected)/settings/account/page.tsx`
- [ ] Change email (`updateUser({ email })`)
- [ ] Change password (`updateUser({ password })`)
- [ ] Delete account → triggers U1 deletion flow (see below)

### 7.3 Storage dashboard

- [ ] Usage bar with quota
- [ ] List uploaded files, group by linked scenario, with delete button
- [ ] Delete file → remove from bucket + update quota + delete `uploaded_files` row

### 7.4 Verify

- [ ] Avatar change reflected in navbar without reload (revalidatePath)
- [ ] Email change emits a confirmation flow
- [ ] Storage bar updates after delete

---

## Phase U1 — User data, GDPR, onboarding (gap closure)

### U1.1 Data export

- [ ] Migration `018_create_data_export_jobs.sql` — id, user_id, status enum (`queued`, `processing`, `ready`, `failed`), file_path, created_at, completed_at, expires_at (default now()+7d)
- [ ] `requestDataExport()` server action — rate-limited (1 per 24h per user); inserts queued row; returns immediately
- [ ] Cron route `src/app/api/cron/process-exports/route.ts` (or Supabase function) — picks queued jobs, gathers rows from profiles/scenarios/sections/event_tables/votes/favorites/comments/warbands/warband_units/campaign_state/unit_campaign_progress/matches/uploaded_files, packages JSON + asset URLs into a ZIP, uploads to a private `exports/` path, generates signed URL valid 7 days, sets row to `ready`, sends `data_export_ready` notification (N2)
- [ ] `src/app/(protected)/settings/privacy/page.tsx` — "Download my data" button + history of past exports

### U1.2 Account deletion cascade (specified)

Document in `docs/data-deletion.md` and implement:
- [ ] Hard delete `auth.users` row → cascades `profiles` (FK)
- [ ] DB cascades remove: scenarios, scenario_sections, event_tables, comments, votes, favorites, uploaded_files, warbands, warband_units, campaign_state, unit_campaign_progress, matches owned by user
- [ ] **Preserve** `matches` rows where the deleted user is only the *opponent* (set `opponent_warband_id = null`, prepend `[deleted user]` to `opponent_name`); enforce via trigger
- [ ] **Preserve** comment threads anonymously: replace `user_id` with sentinel `00000000-0000-0000-0000-000000000000` "Deleted user" profile (created in seed)
- [ ] Storage cleanup: delete user's files from `scenario-assets` and `avatars`
- [ ] Audit row written to `moderation_actions` if deletion is admin-initiated

### U1.3 Retention policy

- [ ] Document in `/privacy` (Sanity legal doc): logs 30 days, exports 7 days, account data deleted within 30 days of request
- [ ] Cron `prune-expired-exports` daily

### U1.4 Onboarding / FTUE

- [ ] First-login dialog with three CTAs: "Browse scenarios", "Build a warband", "Read the rules"
- [ ] Empty states for each dashboard (Warbands, Favorites, Storage) with grimdark illustration + CTA
- [ ] Map editor first-run tour: 3-step popover walkthrough using shadcn Tooltip/Popover (Toolbar → LayerPanel → Save)
- [ ] Tracked via `profiles.onboarding_state` jsonb (which steps completed)

### U1.5 Contact / feedback

- [ ] Migration `017_create_contact_and_feedback.sql` — `feedback` table (id, user_id NULL, kind enum `bug` / `feature` / `support`, subject, body, email NULL, created_at, status enum)
- [ ] `src/app/(public)/contact/page.tsx` — public form, Turnstile-protected (S1)
- [ ] Server action `submitFeedback` — emails admins via N1 + inserts row
- [ ] Admin queue page in F3 includes a "Feedback" tab

### U1.6 Verify

- [ ] Request export → notification arrives → ZIP contains all owned content
- [ ] Delete a test account → comments authored remain visible as "Deleted user"; opponent matches retain history
- [ ] Empty Warbands dashboard renders the empty state with CTA

---

## Phase F2 — Middleware & route protection

- [ ] `src/lib/utils/roles.ts` — `isAdmin`, `isCoAdmin`, `isModeratorOrAbove`, `requireAdmin`, `requireModerator`, `canManageRoles`, `canAccessSanity`
- [ ] Update `src/middleware.ts`:
  - `/admin/*` → require admin or co_admin
  - Banned users → 403 page; allow read-only public browse only
- [ ] Defense-in-depth: every admin server action calls `requireModerator(profile)`

---

## Phase F3 — Admin dashboard UI

### F3.1 Layout

- [ ] `src/app/(protected)/admin/layout.tsx` — sidebar + role gate + role badge
- [ ] Stats cards in top bar (pending reports count from realtime channel)

### F3.2 Pages

- [ ] `/admin/page.tsx` — overview (users, pending reports, bans 7d, featured count, storage usage)
- [ ] `/admin/reports/page.tsx` — queue with filters + bulk actions
- [ ] `/admin/users/page.tsx` — search, ban/unban, change role (admin only)
- [ ] `/admin/content/page.tsx` — Scenarios / Campaigns / Comments / Warbands tabs; hide/unhide, feature/unfeature
- [ ] `/admin/log/page.tsx` — audit log (admin sees all, co-admin sees own)
- [ ] `/admin/feedback/page.tsx` — bug/feature/support queue (U1.5)

### F3.3 Components

- [ ] `AdminSidebar`, `StatsCard`, `ReportCard`, `ReportDetail`, `UserRow`, `UserDetail`, `ContentRow`, `AuditLogEntry`, `RoleBadge`, `BanDialog`

### F3.4 Server actions (`src/lib/actions/admin.ts`)

- [ ] `resolveReport`, `dismissReport` — also send N2 notification to reporter
- [ ] `banUser`, `unbanUser` — N2 to target user
- [ ] `hideContent`, `unhideContent`
- [ ] `featureScenario`, `unfeatureScenario`
- [ ] `changeUserRole` (admin only)
- [ ] `deleteUser` (admin only) — calls U1.2 cascade
- [ ] All write `moderation_actions`

### F3.5 Verify

- [ ] Co-admin can resolve a report; cannot see role-change UI
- [ ] Hidden content disappears from public browse
- [ ] Banning a user surfaces the banner on their next request

---

## Phase H5 — Monitoring & error tracking

- [ ] `npm i @sentry/nextjs @vercel/analytics @vercel/speed-insights`
- [ ] `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- [ ] `next.config.ts` — Sentry webpack plugin with source map upload
- [ ] `tracesSampleRate: 0.1`
- [ ] Add `<Analytics />` and `<SpeedInsights />` to `src/app/layout.tsx`
- [ ] **Custom analytics events** (Vercel + Sentry breadcrumbs): `scenario_created`, `scenario_published`, `warband_created`, `match_logged`, `report_submitted`, `data_export_requested`
- [ ] UptimeRobot configured for production URL with email alert
- [ ] Supabase usage alerts at 80% of free tier (storage, DB size)

---

## Sprint 7 — Verify

- [ ] As a banned test user: cannot create, vote, comment, upload; banner present; logout works
- [ ] As an admin: full dashboard works; audit log records every action
- [ ] As a normal user: can request data export, get email + bell when ready, download ZIP
- [ ] Sentry receives a manually-triggered error in production preview
