# Forgotten Letters — TODO

> Build roadmap for the wargame scenario platform, on the **open-source / self-hostable**
> stack: Next.js 15 + PostgreSQL (Drizzle) + Auth.js + Cloudflare R2 + MDX, deployed on
> AWS, funded by ads + supporter tiers. Work through phases in order; tick boxes as you go.
> See [`docs/`](docs/) for architecture, deployment, cost, monetization, and design specs.
> For the **local-first execution strategy** (devcontainer + docker, test/security gates per
> phase, then hosting), see [`docs/BuildPlan.md`](docs/BuildPlan.md).

---

## Phase 0: Planning & docs ✅

- [x] Re-architect off managed SaaS (Vercel/Supabase/Sanity) → open-source AWS stack
- [x] Write `docs/Architecture.md`, `Deployment.md`, `Costs.md`, `Monetization.md`
- [x] Port design tokens → `docs/DesignSystem.md`; catalog surfaces → `docs/UI-Surfaces.md`
- [x] Author the Claude Design redesign prompt → `docs/ClaudeDesign-Prompt.md`
- [x] Update `README.md` and `.env.example` for the new stack

---

## Phase 1: Bootstrap, theme & auth

### 1.1 — Initialize Next.js
- [ ] `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [ ] Set `output: 'standalone'` in `next.config.ts`; verify `npm run dev` on :3000
- [ ] Strip boilerplate from `src/app/page.tsx` and `layout.tsx`

### 1.2 — Design system
- [ ] Add the `FL` tokens to `globals.css` as CSS vars + Tailwind v4 `@theme`
      (copy from `docs/DesignSystem.md`)
- [ ] Load Cinzel / Inter / JetBrains Mono; add `.fl-grain` utility
- [ ] `npx shadcn@latest init` (dark, zinc base) → re-theme from FL tokens
- [ ] Port the icon set + brand mark (`FLMark`) from the design bundle

### 1.3 — Database (Postgres + Drizzle)
- [ ] `docker compose up -d db`; `npm install drizzle-orm pg && npm install -D drizzle-kit`
- [ ] Create `src/lib/db/client.ts` and `src/lib/db/schema.ts`
- [ ] Configure `drizzle.config.ts`; wire `npm run db:generate` / `db:migrate`

### 1.4 — Auth.js (NextAuth v5)
- [ ] `npm install next-auth@beta @auth/drizzle-adapter`
- [ ] `src/lib/auth/` — Auth.js config, Drizzle adapter, Credentials + Google + GitHub
- [ ] Auth.js core tables in Drizzle schema; session = database strategy
- [ ] `src/middleware.ts` — protect `/settings/*`, `/scenarios/new`, `/scenarios/*/edit`,
      `/campaigns/new`, `/campaigns/*/edit`, `/warbands/new`, `/warbands/*/edit`, `/forge`
- [ ] On user create, insert a `profiles` row (adapter hook or trigger)

### 1.5 — Auth pages & email
- [ ] `/(auth)/login`, `/register`, `/forgot-password` (per `Auth.jsx`)
- [ ] Email verification + **reset-with-token** pages (design gap — see UI-Surfaces)
- [ ] Wire Amazon SES SMTP for verification / reset mail
- [ ] Zod schemas in `src/lib/validations/auth.ts`

### 1.6 — Layout shell
- [ ] `components/layout/Navbar.tsx` + `Footer.tsx` (per `Chrome.jsx`, 4 navbar variants)
- [ ] `components/layout/QuickDrawer.tsx` (per `QuickDrawer.jsx`)
- [ ] `app/(public)/page.tsx` — Landing (per `Landing.jsx`, desktop + mobile)

### 1.7 — Verify
- [ ] Register → verify email → login; Google + GitHub OAuth; forgot/reset works
- [ ] Protected routes redirect when unauthenticated; logout clears session

---

## Phase 2: Database schema & storage

### 2.1 — Schema (Drizzle + SQL migrations)
- [ ] Enums: `section_type`, `target_type`, `subscription_tier`
- [ ] Core tables (carried from original plan): `profiles`, `game_systems`, `campaigns`,
      `scenarios`, `scenario_sections`, `event_tables`, `uploaded_files`, `votes`,
      `favorites`, `comments`
- [ ] Monetization tables: `subscriptions`, `entitlements`, `forge_jobs`
- [ ] Indexes: slugs, author_id, campaign_id, scenario_id, (target_type,target_id),
      is_published, created_at

### 2.2 — Logic (functions/triggers, replacing Supabase RLS/triggers)
- [ ] `handle_new_user` equivalent (profiles row on signup)
- [ ] `check_user_storage_quota(user_id, size)` using `entitlements.storage_quota_bytes`
- [ ] `update_storage_used` on uploaded_files insert/delete
- [ ] `get_vote_count(target_type, target_id)`
- [ ] **App-layer authorization** helpers in `src/lib/auth/guards.ts` (ownership/role
      checks replace RLS in every server action)

### 2.3 — Object storage (Cloudflare R2)
- [ ] `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- [ ] `src/lib/storage/r2.ts` — client, presigned PUT/GET, key helpers
- [ ] Buckets: `assets` (5 MB image cap), `avatars` (2 MB cap); enforce MIME + quota
      in the upload server action
- [ ] Cloudflare custom domain → `NEXT_PUBLIC_ASSET_BASE_URL` (zero-egress reads)

### 2.4 — Seed & verify
- [ ] Seed "Trench Crusade" game system
- [ ] New user → profiles + entitlements (Conscript defaults) created
- [ ] User A's unpublished scenario invisible to user B / anon; B cannot edit it
- [ ] Upload updates storage counter; over-quota upload rejected

---

## Phase 3: Official content (MDX, replaces Sanity)

- [ ] `npm install next-mdx-remote` (or `@next/mdx`); content under `src/content/`
- [ ] `src/content/rules/<edition>/*.mdx`, `legal/*.mdx`, `faq.mdx`, `official/*.mdx`
- [ ] `/rules`, `/rules/[slug]`, `/rules/compendium/[slug]` (per `Rules.jsx`,
      `Compendium.jsx`) with **rules-version selector** driven by edition folders
- [ ] `/official`, `/official/[slug]`; `/legal`, `/faq` (per `Marketing.jsx`)
- [ ] Verify version switching renders the right edition; content edits land via PR

---

## Phase 4: Campaign & scenario CRUD

- [ ] Zod schemas: `campaign.ts`, `scenario.ts`
- [ ] Server actions: campaigns (create/update/delete/duplicate),
      scenarios (create/update/delete/duplicate/publish) — each with authz guard
- [ ] Campaign pages: `/campaigns/new` (wizard), `/campaigns/[slug]` (lobby per
      `Campaign.jsx`), `/campaigns/[slug]/edit`
- [ ] **Campaign graph editor** (per `Campaigns.jsx`) — nodes (Start/Scenario/Finale),
      branching edges with Victory/Defeat labels, reward nodes, inspector
- [ ] Scenario editor (per `ScenarioEditor.jsx`) — tabbed inspector (Map/Scenario/Story/
      Campaign/Rules), Tiptap story, event tables, rewards
- [ ] Duplicate = deep copy (scenario + sections + event tables, new author, unpublished)
- [ ] Verify CRUD, duplicate, cascade delete, author-only edit

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

## Phase 7: Social, profiles & play loop

- [ ] Voting, favorites, comments (threaded), share + OG tags — `components/social/`
- [ ] Public profile (per `Profile.jsx`): career, match history, campaigns, activity
- [ ] Browse/search for scenarios, campaigns, warbands (filters, sort, pagination, search)
- [ ] **Play loop** (design gap): Battle Tracker, Post-battle Report, Warband resolution
- [ ] Notifications inbox; News/Dispatches feed
- [ ] Verify votes/favorites/comments persist; profiles + browse return correct results

---

## Phase 8: Account, settings & AI Forge

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
