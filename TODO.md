# Forgotten Letters — TODO

> Build roadmap for the wargame scenario platform, on the **open-source / self-hostable**
> stack: Next.js 15 + PostgreSQL (Drizzle) + Auth.js + Cloudflare R2 + MDX, deployed on
> AWS, funded by ads + supporter tiers. Work through phases in order; tick boxes as you go.
> See [`docs/`](docs/) for architecture, deployment, cost, monetization, and design specs.
> For the **local-first execution strategy** (devcontainer + docker, test/security gates per
> phase, then hosting), see [`docs/BuildPlan.md`](docs/BuildPlan.md).

---

## Design Lab (grimdark redesign) — ACTIVE

Standalone `design-lab/` sandbox exploring the grimdark blood/gold/Cinzel direction
before porting into the main app. See `docs/superpowers/specs/` and `docs/superpowers/plans/`.

- [x] Repo hygiene: gitignore unrelated agent tooling, commit real project files
- [x] Commit graphify / impeccable / design-sync as repo tooling
- [x] Scaffold Vite design-lab + grimdark tokens
- [x] Port SVG art, icons, primitives, and nav/footer chrome
- [x] Design System showcase page (`/design-system`)
- [x] Faithful grimdark Profile page port (`/profile`)
- [x] anime.js motion layer + animated hero backdrop (reduced-motion safe)
- [x] Port grimdark tokens/components into `src/components/ui` + re-sync Claude Design
- [x] Reconcile the grimdark palette with the `FL` tokens — they were already the
      same colors; see Phase 1.2

---

## Phase 0: Planning & docs ✅

- [x] Re-architect off managed SaaS (Vercel/Supabase/Sanity) → open-source AWS stack
- [x] Write `docs/Architecture.md`, `Deployment.md`, `Costs.md`, `Monetization.md`
- [x] Port design tokens → `docs/DesignSystem.md`; catalog surfaces → `docs/UI-Surfaces.md`
- [x] Author the Claude Design redesign prompt → `docs/ClaudeDesign-Prompt.md`
- [x] Update `README.md` and `.env.example` for the new stack

---

## Phase 0b: Local dev foundation ✅

Implemented per [`docs/BuildPlan.md`](docs/BuildPlan.md) Part A.

**A1 — local services + devcontainer**

- [x] `.devcontainer/docker-compose.yml`: dev box + Postgres 16 + MinIO + Mailpit + bucket init
- [x] Rewrite `devcontainer.json` onto the compose stack
- [x] Root `Dockerfile` (multi-stage, standalone, non-root) + `.dockerignore`
- [x] Root `docker-compose.yml` (prod-shaped app + db)

**A2 — reconcile the scaffold**

- [x] Delete `supabase/`, `sanity/`, `src/lib/supabase/`, `src/lib/sanity/`
- [x] Set `output: 'standalone'` in `next.config.ts`
- [x] Add stack deps (drizzle-orm, pg, next-auth@5, @aws-sdk/client-s3, nodemailer, zod)
- [x] Migrate `next lint` → ESLint CLI
- [x] Exclude `design-lab/` from the root typecheck (separate Vite app, own deps)
- [x] Pin nodemailer ^9 via override — next-auth v5 peers a 7.x with unpatched
      SMTP-injection advisories (rationale in `package.json`)

**A3 — typed config + parity layer**

- [x] `src/lib/env.ts` (Zod-validated, fails fast, prod-only guardrails)
- [x] `src/lib/db/` client + minimal Auth.js schema; migrations → `db/migrations/`
- [x] `src/lib/storage/r2.ts` (presigned PUT/GET, path-style aware)
- [x] `src/lib/mail/` (SMTP: Mailpit local, SES prod)
- [x] `.env.example` ships working local defaults

**A4 — quality + security gates**

- [x] `/api/health` (db + storage + mail; 503 when degraded, never cached)
- [x] Vitest + unit tests; Playwright + e2e smoke suite
- [x] Prettier, Husky + lint-staged pre-commit
- [x] `ci.yml` (verify against real services / audit + gitleaks / prod image build)
- [x] `.gitleaks.toml`, `dependabot.yml`

> **Phase 0 gate met:** migrations apply, `/api/health` returns 200 with all three
> checks true, 10 unit + 5 e2e tests pass, and build/typecheck/lint/format/audit and
> the production `docker build` are green. Remaining: confirm CI is green on GitHub
> (the workflow has not run yet).

---

## Phase 1: Theme reconciliation & auth

### 1.2 — Design system ✅

> The "grimdark vs FL" conflict was a misreading: both are the **same palette**, one using
> semantic names (`--color-bg`) and one numbered tokens (`FL 01`). Every hex matches.

- [x] Port grimdark tokens + `src/components/ui` primitives from `design-lab/`
- [x] Verify `globals.css` against the 16 FL tokens — all matched
- [x] Add the two missing tokens: FL 10 Aged Brass (`--color-accent-dim`),
      FL 16 Steel Blue (`--color-info`)
- [x] Cinzel / Inter / JetBrains Mono (already loaded in `layout.tsx`); `.fl-grain` added
- [ ] Port the icon set + brand mark (`FLMark`) from the design bundle

### 1.3 — Database (Postgres + Drizzle) ✅

Done in Phase 0b / A3.

- [x] Compose Postgres; drizzle-orm + pg + drizzle-kit installed
- [x] `src/lib/db/client.ts` and `src/lib/db/schema.ts`
- [x] `drizzle.config.ts`; `db:generate` / `db:migrate` / `db:push` / `db:studio` wired

### 1.4 — Auth.js (NextAuth v5)

> Deps are already installed and the four adapter tables already exist in the schema
> and are migrated (A3). Note next-auth v5 is still **beta** (`5.0.0-beta.31`).

- [x] `next-auth@beta` + `@auth/drizzle-adapter` installed
- [x] Auth.js core tables in Drizzle schema (`users`, `accounts`, `sessions`,
      `verificationToken`), migration applied
- [x] `src/lib/auth/` — Auth.js config, Drizzle adapter, Credentials + Google + GitHub
- [x] Session strategy: **JWT, not database** — Auth.js cannot persist a session row for
      Credentials sign-ins, so `strategy: "database"` renders every request signed out
- [x] `src/lib/auth/guards.ts` — requireUser / requireAdmin / assertOwner (replaces RLS)
- [x] `src/middleware.ts` — protects /settings, /scenarios/new, /campaigns/new,
      /warbands/new, /forge, and `*/edit`; preserves callbackUrl
- [x] On user create, insert a `profiles` row (same transaction as the user insert)

### 1.5 — Auth pages & email

- [x] `/(auth)/login` and `/register` wired to real server actions
- [x] SMTP wired (Mailpit locally, SES in prod) — welcome + enumeration-safe mail sends
- [x] Zod schemas in `src/lib/validations/auth.ts`
- [ ] `/forgot-password` + reset-with-token flow (page exists but is not wired)
- [ ] Email verification flow (`emailVerified` column exists; nothing sets it yet)

### 1.6 — Layout shell

- [x] `Navbar.tsx` + `Footer.tsx` exist; navbar is now **session-aware** (UserMenu with
      profile / settings / sign-out, resolved server-side so there is no signed-out flash)
- [ ] `components/layout/QuickDrawer.tsx` (per `QuickDrawer.jsx`)
- [ ] Landing page still renders mock data

### 1.7 — Verify

- [x] Register → login → protected page (8 e2e journeys against the live stack)
- [x] Protected routes redirect when unauthenticated; sign-out clears the session
- [x] Enumeration safety: unknown email and wrong password are indistinguishable
- [ ] Google + GitHub OAuth — code paths exist but are **untested**: verifying them
      needs real OAuth apps and credentials
- [ ] Email verification and forgot/reset journeys (not yet built)

---

## Phase 2: Database schema & storage

### 2.1 — Schema (Drizzle + SQL migrations) ✅

- [x] Enums: `section_type`, `target_type`, `subscription_tier`,
      `subscription_status`, `forge_job_status`
- [x] Core tables: `profiles`, `game_systems`, `campaigns`, `scenarios`,
      `scenario_sections`, `event_tables`, `uploaded_files`, `votes`, `favorites`,
      `comments`
- [x] Monetization tables: `subscriptions`, `entitlements`, `forge_jobs`
- [x] Indexes: per-author unique slugs, author_id, campaign_id, game_system_id,
      (target_type,target_id), is_published, created_at
- [x] 17 tables migrated and verified against the live database

### 2.2 — Logic (application-layer, replacing Supabase RLS/triggers) ✅

- [x] `handle_new_user` equivalent — profiles **and** entitlements rows created in the
      same transaction as the user insert (registration action)
- [x] `check_user_storage_quota` → `checkStorageQuota()`, reading
      `entitlements.storageQuotaBytes` rather than a constant
- [x] `update_storage_used` → maintained transactionally in `recordUpload` /
      `deleteUpload`, with `recalculateStorageUsed()` as the repair path
- [x] `get_vote_count` → `getVoteCount()` + batched `getVoteCounts()` (avoids N+1)
- [x] App-layer authorization helpers in `src/lib/auth/guards.ts`

### 2.3 — Object storage (MinIO locally / R2 in prod) ✅

- [x] `@aws-sdk/client-s3` + `s3-request-presigner` installed (Phase 0 A2)
- [x] `src/lib/storage/r2.ts` — client, presigned PUT/GET, delete, key helpers
- [x] `src/lib/storage/upload-policy.ts` — MIME allowlist (SVG excluded: it can carry
      script and the assets bucket is public-read), 5 MB assets / 2 MB avatars caps,
      user-namespaced server-generated keys
- [x] Two-step upload action: presign (validated + quota-checked) then confirm
      (re-checked inside a transaction; orphaned objects removed on failure)
- [ ] Cloudflare custom domain → `NEXT_PUBLIC_ASSET_BASE_URL` — **needs a real
      Cloudflare account and domain; deferred to Phase 10**

### 2.4 — Seed & verify ✅

- [x] Idempotent seed for the "Trench Crusade" game system (`npm run db:seed`)
- [x] New user → profiles + entitlements (Conscript defaults) created transactionally
- [x] Upload updates the storage counter; over-quota upload rejected; concurrent
      uploads cannot both exceed the quota (row-locked, proven by test)
- [x] One user cannot delete another's file
- [ ] User A's unpublished scenario invisible to B — **the guards and `isPublished`
      column exist, but there are no scenario read paths yet to enforce it on;
      lands with Phase 4 CRUD**

---

## Phase 3: Official content (MDX, replaces Sanity) ✅

- [x] `next-mdx-remote` + `gray-matter` + `remark-gfm` + `rehype-sanitize`/`rehype-slug`
- [x] `src/content/rules/<edition>/*.mdx`, `legal/*.mdx`, `faq.mdx`, `official/*.mdx`
- [x] `/rules`, `/rules/[edition]/[slug]` with an **edition selector driven by the
      directory listing** — adding an edition is a `mkdir`, not a code change
- [x] `/official`, `/official/[slug]`; `/legal/[slug]`; `/faq`
- [x] Version switching verified: v1 and v2 serve genuinely different content for the
      same slug; an unknown edition 404s rather than silently falling back
- [x] Path-traversal guard on every URL-supplied segment (tested)
- [x] MDX sanitized on render, so a careless paste cannot become stored XSS
- [ ] `/rules/compendium/[slug]` — the Compendium surface is not built yet

> **IP note:** content is deliberately community-authored _authoring context_, not
> reproduced publisher rules text. The FAQ and legal pages state the project is
> unaffiliated, and a test asserts that disclaimer is present.

---

## Phase 4: Campaign & scenario CRUD — partial

- [x] Zod schemas for scenarios, sections, and event tables (`validations/scenario.ts`)
- [x] HTML sanitization on write (`lib/sanitize.ts`)
- [x] Scenario server actions: create / update / delete / publish / duplicate, each
      ownership-guarded
- [x] Scenario editor at `/scenarios/new` and `/scenarios/[slug]/edit` — one component
      for both, tabbed (Basic / Sections / Event tables), wired to the real actions
- [x] Duplicate = deep copy (scenario + sections + event tables, new author, unpublished,
      detached from the source campaign)
- [x] Verified: create → persist → reload → publish; per-field validation errors;
      event tables round-trip; author-only edit returns 404 for others; anonymous
      users redirected
- [x] Campaign server actions: create / update / delete / publish, graph save, and
      scenario attach-detach — each ownership-guarded
- [x] Campaign pages: `/campaigns`, `/campaigns/[username]/[slug]`,
      `/campaigns/new`, `/campaigns/[username]/[slug]/edit`
- [x] Campaign graph **data layer**: validated (dangling edges, self-loops, duplicate
      ids, and multiple start nodes all rejected), persisted, and rendered read-only
      as an outline on the detail page
- [ ] **Campaign graph editor canvas** — drag-and-drop node/edge editing. Blocked on
      the missing design bundle; the data layer beneath it is done and tested
- [ ] Tiptap rich-text story editing (sections are plain textareas today; the
      sanitizer is already in place for when Tiptap lands)

> **Blocked on missing design input:** `docs/UI-Surfaces.md` names an 18-prototype
> bundle under `project/components/` as the UI source of truth, but that bundle is
> **not in this repository**. The editor above was built from the written spec and the
> existing primitives — it is functionally complete but is not a faithful reproduction
> of the intended design. The graph editor, warband builder, and Forge depend far more
> heavily on that missing visual spec.

---

## Phase 5: 2D map editor

- [ ] `npm install react-konva konva`; editor at `/scenarios/[slug]/edit` (map tab)
- [ ] `components/map-editor/` — Stage/Layer/grid, `useMapEditor`, `useUndoRedo`, pan/zoom
- [ ] Toolbar + shape library (trench/building/crater/wire/cover), properties panel
- [ ] **Shape export** + image import (presigned R2 upload, 5 MB cap, quota check,
      `is_temporary=true`)
- [ ] Layers panel; deployment zones; save/load `scenarios.map_data` JSON; PNG export
- [ ] Temp-file cleanup task (24h) — deletes abandoned uploads from DB + R2
- [ ] Verify persistence, undo/redo, export, quota rejection, temp cleanup

---

## Phase 6: Warbands

- [ ] Faction picker + builder (per `WarbandV2.jsx`): left rail (Ducats/Glory/faction +
      sub-faction rules), roster cards with TC stat blocks, recruit modal with
      portrait/sigil + full profile
- [ ] Warbands browser (per `WarbandsBrowser.jsx`): faction cards, **leaderboard per rules
      version**, your warbands, archive with favorite/copy
- [ ] Warband public detail + fighter detail panel
- [ ] Server actions: create/update/delete/favorite/copy warband; campaign submit + approval
- [ ] Verify build, save/load, leaderboard, favorite/copy, submit-to-campaign + approval

---

## Phase 7: Social, profiles & play loop — partial

- [x] Votes and favorites: actions + idempotent, batched counting
- [x] Threaded comments on scenarios — post, reply (one level), soft-delete with
      tombstone so replies keep their position; sanitized on write and covered by an
      e2e test that posts a live XSS payload
- [x] Public profiles at `/user/[username]` with published counts; the owner sees
      their own drafts, visitors do not
- [x] Browse + search with filters in the URL (shareable), pagination
- [x] Battle tracker — record games against a campaign with participants, results,
      scores, and notes; owner-only recording and deletion
- [x] Notifications — in-app feed, unread badge, mark-all-read; comment and reply
      notifications, with self-notification suppressed

- [ ] News

### Original scope

- [ ] Voting, favorites, comments (threaded), share + OG tags — `components/social/`
- [ ] Public profile (per `Profile.jsx`): career, match history, campaigns, activity
- [ ] Browse/search for scenarios, campaigns, warbands (filters, sort, pagination, search)
- [ ] **Play loop** (design gap): Battle Tracker, Post-battle Report, Warband resolution
- [x] Notifications — in-app feed, unread badge, mark-all-read; comment and reply
      notifications, with self-notification suppressed
      inbox; News/Dispatches feed
- [ ] Verify votes/favorites/comments persist; profiles + browse return correct results

---

## Phase 8: Account, settings & AI Forge — partial

- [x] Profile settings: username / display name / bio, with username collision
      handling and markup stripped from bios
- [x] Account settings: email display, account deletion behind a typed-email
      confirmation, cascading to every owned row and clearing the session
- [x] Storage dashboard: real quota and usage from `entitlements` + `profiles`,
      file listing, colour-coded usage bar
- [x] Avatar upload — presigned PUT straight to storage, quota-counted, replacing
      an avatar frees the previous one; verified by fetching the uploaded object
      back over HTTP
- [x] 2FA (TOTP) — enrolment with QR, login challenge, single-use recovery codes,
      code-protected disable
- [ ] Notification preferences
- [ ] **AI Forge** — blocked: no provider contract defined and no API key available

### Original scope

- [ ] Settings (per `Settings.jsx`): Profile, Account (email/password/2FA/delete),
      Notifications, Storage dashboard, Privacy
- [ ] **2FA** setup + challenge; delete-account flow (design gaps)
- [ ] AI Forge (per `Forge.jsx`): part selector, prompt, provider calls (server-only),
      variant compare, STL re-mesh, `forge_jobs` + credit debit from entitlements
- [ ] Verify settings round-trip, avatar upload, storage delete frees quota, Forge debits
      credits and stores outputs in R2

---

## Phase 9: Monetization & ads

> Spec: [`docs/Monetization.md`](docs/Monetization.md)

- [ ] `components/monetization/`: `AdSlot`, `CookieConsent`, `UpsellDialog`, `SupporterBadge`
- [ ] EthicalAds/Carbon primary; AdSense fallback gated behind consent
- [ ] `AdSlot` renders nothing when `entitlements.ads_disabled`; placements restricted to
      browse rails / list pages (never editor/builder/tracker/forge)
- [ ] Stripe: `lib/billing/` (client, entitlement computation, feature gates), Checkout,
      `/api/webhooks/stripe`, Customer Portal entry (Billing management page)
- [ ] Pricing page wired to tiers (Conscript/Veteran/Cartographer); Support page with
      GitHub Sponsors + Ko-fi; optional `/api/webhooks/kofi` → supporter badge
- [ ] Feature gates enforce quotas (storage, warbands, scenarios, private campaigns,
      Forge credits) in server actions
- [ ] Verify: supporter sees no ads; consent gates AdSense; checkout → webhook →
      entitlements update; quota boundary shows upsell; cancel → downgrade at period end

---

## Phase 10: Self-host on AWS & launch

> Spec: [`docs/Deployment.md`](docs/Deployment.md)

- [ ] `Dockerfile` (standalone) + `docker-compose.yml` (app + Postgres)
- [ ] Deploy to **Lightsail Containers**; Postgres co-located or RDS micro
- [ ] Cloudflare DNS/TLS/CDN + R2 custom domain + cache rules
- [ ] Amazon SES domain verification + production access
- [ ] GitHub Actions: lint/typecheck/test → build image → migrate → deploy
- [ ] `/api/health`; Postgres nightly `pg_dump` → R2; R2 versioning + temp lifecycle
- [ ] Moderation queue + user admin + audit log (admin completeness)
- [ ] SEO: `generateMetadata`, `sitemap.ts`, `robots.ts`, JSON-LD
- [ ] Rate limiting (`rate-limiter-flexible`, Postgres) on auth/comments/votes/uploads
- [ ] Sanitize user markdown/HTML; security pass on all authz guards
- [ ] Error tracking (free-tier / self-hosted) + Cloudflare Web Analytics
- [ ] Verify: production deploy stable; Lighthouse Perf>80 / A11y>90 / SEO>90; cost floor
      ~$10–20/mo confirmed; restore-from-backup tested

---

## Post-launch (v2 backlog)

- [ ] Onboarding flow + empty states for every index
- [ ] Real-time collaboration on map editor / battle tracker
- [ ] Scenario versioning / edit history; notifications expansion
- [ ] Additional game systems beyond Trench Crusade
- [ ] Scenario / warband PDF export; tabletop QR "share at the table"
- [ ] Payload CMS (if non-technical editing of news/official content is needed)
- [ ] API docs / Changelog / Status / About pages
