# Sprint 8 — Hardening & Launch Prep

> Goal: everything required between feature-complete and a public launch:
> markdown safety, anti-spam, rate limits, legal pages, accessibility,
> backups, schema reconcile, and the test suite that gates production.
>
> Phases included: **8, F5, G6, H6, H7, S1, S2** (S1, S2 are gap-closing
> phases — see `00-master-plan.md`).

---

## Phase S1 — Markdown pipeline + anti-spam (gap closure)

### S1.1 Markdown rendering

- [ ] `npm i react-markdown remark-gfm rehype-sanitize`
- [ ] `src/lib/markdown/render.tsx` — exports `<Markdown>` component
- [ ] Custom sanitize schema (allow-list):
  - tags: `p`, `br`, `strong`, `em`, `code`, `pre`, `blockquote`, `ul`, `ol`, `li`, `a`, `h2`, `h3`, `h4`, `hr`, `img` (only `https://` from approved CDN domains)
  - attrs: `href` (validated `https?://`), `title`, `alt`, `src`
  - reject inline event handlers and `style`
- [ ] Replace raw `dangerouslySetInnerHTML` everywhere comments / scenario story / news bodies render
- [ ] Add Vitest snapshot tests for known-XSS payloads → all neutralised

### S1.2 Anti-spam (Cloudflare Turnstile)

- [ ] Create site at Cloudflare; add `TURNSTILE_SITE_KEY` (public) + `TURNSTILE_SECRET_KEY`
- [ ] `src/components/security/Turnstile.tsx` — client widget
- [ ] `src/lib/security/verify-turnstile.ts` — server-side verify
- [ ] Mount on: register, contact form, password reset, first-comment from a new account, report submission
- [ ] Mandatory email verification before any UGC action

### S1.3 Rate limiting

- [ ] `npm i @upstash/ratelimit @upstash/redis` (or use a Postgres `rate_limits(user_id, action, window_start, count)` table — atomic upsert in server actions)
- [ ] Limits:
  - File uploads: 10/h
  - Reports: 5/h
  - Scenario creation: 20/d
  - Warband creation: 10/h (also DB trigger)
  - Vote/favorite toggle: 60/min
  - Comment creation: 30/h
  - Contact submission: 3/h
- [ ] Centralise in `src/lib/security/rate-limit.ts`; apply to relevant server actions

### S1.4 Verify

- [ ] Stored XSS payload in a comment renders as text, never executes
- [ ] 11th upload in an hour → rejected with clear toast
- [ ] Registration without Turnstile token → rejected

---

## Phase S2 — Backup, recovery, schema reconcile (gap closure)

### S2.1 Migration `015_add_play_count_and_reconcile.sql`

- [ ] Confirm `scenarios.play_count` exists (added in Sprint 2; migration here is a no-op safety net or adds index if missed)
- [ ] Add `scenarios.duplicated_from_scenario_id uuid REFERENCES scenarios(id)` if not added in Sprint 4
- [ ] Add `profiles.email_status text default 'ok' CHECK in ('ok','bounced','complained')` for N1 bounce tracking
- [ ] Add `profiles.onboarding_state jsonb default '{}'` for U1.4
- [ ] Index `scenarios(play_count DESC, created_at DESC)`

### S2.2 Backups

- [ ] Upgrade to Supabase Pro before launch (daily PITR backups included)
- [ ] Cron: nightly `pg_dump` to S3 (or Backblaze B2) bucket via GitHub Actions schedule using `SUPABASE_DB_URL` secret
- [ ] Storage bucket sync: nightly `rclone` from `scenario-assets` and `avatars` to cold storage
- [ ] Retention: 7 daily + 4 weekly + 3 monthly
- [ ] Document recovery runbook in `docs/disaster-recovery.md`

### S2.3 Verify

- [ ] Restore-test in a scratch project: pick yesterday's dump → run migrations → verify a row count
- [ ] All cross-plan column references resolve (`play_count`, `duplicated_from_scenario_id`, `email_status`, `onboarding_state`)

---

## Phase 8 — Polish, SEO, legal

### 8.1 Error & loading states

- [ ] `src/app/error.tsx`, `src/app/not-found.tsx`
- [ ] Per-route `error.tsx` for `(protected)/admin`, `(protected)/warbands`, `(protected)/scenarios`
- [ ] Skeletons (use shadcn `Skeleton`): browse grids, scenario detail, warband builder, admin tables
- [ ] Toast notifications on all mutations (success/error)
- [ ] Confirmation dialogs for destructive actions (delete scenario, delete account, ban user)

### 8.2 Responsive

- [ ] Navbar hamburger (Sheet) on `< md`
- [ ] Browse filters stacked vertically on mobile, sticky filter bar
- [ ] Warband builder: bottom sheet for catalogue on mobile
- [ ] Map editor: desktop-required banner on mobile (already in Sprint 5)
- [ ] Settings sidebar collapses on mobile

### 8.3 SEO

- [ ] `generateMetadata()` on every public page (title, description, OG image)
- [ ] `src/app/sitemap.ts` — published scenarios + campaigns + public warbands + rules + news
- [ ] `src/app/robots.ts` — allow all; disallow `/admin`, `/settings`, `/auth`
- [ ] JSON-LD on scenario pages (`CreativeWork` schema with author, dateCreated, etc.)
- [ ] hreflang only if i18n is enabled (V1: English-only, skip)

### 8.4 Security headers

- [ ] CSP via `next.config.ts` headers — script-src self + Vercel + Sentry + Turnstile; img-src self + Supabase + Sanity CDN; frame-ancestors none
- [ ] HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin
- [ ] Webhook signature checks already added (Sanity revalidate, email bounces, cron secrets)
- [ ] Re-test all RLS policies with three personas (anon, regular user, admin)

### 8.5 Phase H6 — Legal pages

- [ ] Author Terms of Service, Privacy Policy, DMCA, Cookie Policy in Sanity (`legalDocument` schema from Sprint 3)
- [ ] `src/app/(public)/terms/page.tsx`, `/privacy`, `/dmca`, `/cookies` — render via PortableText
- [ ] Footer links updated
- [ ] TOS-acceptance checkbox enforced at registration (re-prompt if user predates current version)
- [ ] Cookie banner shown only if non-essential cookies are added (V1: not required)

### 8.6 Phase H7 — Accessibility

- [ ] Color contrast verified for all token combos (Bone White on Charcoal already 13.5:1)
- [ ] Tab order audited on browse, detail, builder, admin pages
- [ ] All interactive elements keyboard-operable; visible focus ring (Blood Red)
- [ ] Skip-to-content link in `layout.tsx`
- [ ] All form inputs have associated labels
- [ ] Alt text on all images (avatars, map exports, OG previews)
- [ ] `prefers-reduced-motion` disables animations
- [ ] Run axe via Playwright on key pages, capture findings, fix blockers

---

## Phase F5 — Admin polish (parallel)

- [ ] Admin/co-admin badge on Navbar + profiles
- [ ] "Admin" link visible only to moderators
- [ ] All public browse queries verified to filter `is_hidden = false`
- [ ] Homepage hero rotates `is_featured = true` scenarios
- [ ] Banned-user banner + middleware restrictions confirmed

---

## Phase G6 — Initial test suite

- [ ] Unit tests for `src/lib/utils/roles.ts`, all Zod schemas, `calculatePoints`, markdown sanitiser, rate-limit helper
- [ ] Integration tests (mocked Supabase) for `createWarband`, `submitReport`, `logMatch`, `requestDataExport`, `submitFeedback`
- [ ] E2E (Playwright) — P0:
  - auth round-trip (register → confirm → login → logout)
  - warband CRUD (create → add unit → save → delete)
  - scenario create → publish → comment → vote
  - admin: ban a user, hide content
- [ ] E2E — P1:
  - search + filter + paginate
  - data export end-to-end (mock cron tick)
  - notification arrival via realtime
- [ ] E2E — P2:
  - map editor: place shape → save → reload (use Konva test harness)
  - mobile viewport smoke
- [ ] Coverage threshold 70% enforced in CI (already configured Sprint 1)

---

## Sprint 8 — Verify

- [ ] All Lighthouse categories ≥ 80 on three flagship pages (home, scenario detail, browse)
- [ ] Axe audit clean of critical issues
- [ ] All P0/P1 E2E pass on Vercel preview
- [ ] Disaster recovery dry-run from S2.3 succeeds
- [ ] CSP headers present on every response
- [ ] Cron secrets, webhook secrets, Resend, Turnstile, Sentry — all verified live in production env
