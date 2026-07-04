# Forgotten Letters — TODO

> Checklist for building the wargame scenario platform. Work through phases in order.
> Tick boxes as you complete each step. Each phase has verification steps at the end.

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
- [ ] Follow-up: port grimdark tokens/components into `src/components/ui` + re-sync Claude Design

---

## Phase 0: Dev Environment ✅

- [x] Create `.devcontainer` (Dockerfile, devcontainer.json, entrypoint, setup scripts)
- [x] Configure Node 22 LTS, TypeScript, Supabase CLI, Sanity CLI, Vercel CLI
- [x] Set up `.gitignore`, `.env.example`, `.gitmessage`
- [x] Create project folder structure with `.gitkeep` files
- [x] Update `README.md` and `docs/Techstack.md`
- [x] Push initial scaffold to GitHub

---

## Phase 1: Project Bootstrap & Auth

### 1.1 — Initialize Next.js project

- [ ] Inside container: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` (run in `/workspace`)
- [ ] Verify `npm run dev` starts on port 3000
- [ ] Remove boilerplate content from `src/app/page.tsx` and `src/app/layout.tsx`

### 1.2 — Configure shadcn/ui

- [ ] `npx shadcn@latest init` — choose dark theme, zinc palette
- [ ] Install base components: `npx shadcn@latest add button input label card form toast separator avatar dropdown-menu sheet tabs`
- [ ] Verify components appear in `src/components/ui/`

### 1.3 — Set up Supabase project

- [ ] Create Supabase project at supabase.com (org: Forgotten-Letters)
- [ ] Copy project URL and anon key to `.env.local`
- [ ] `npm install @supabase/supabase-js @supabase/ssr`
- [ ] Link local CLI: `supabase link --project-ref <ref>`

### 1.4 — Configure Supabase Auth

- [ ] Enable Email/Password provider in Supabase dashboard → Auth → Providers
- [ ] Enable Google OAuth provider (create Google Cloud OAuth credentials first)
- [ ] Set redirect URLs in Supabase dashboard (localhost:3000 + production URL)

### 1.5 — Supabase client helpers

- [ ] Create `src/lib/supabase/client.ts` — browser client (`createBrowserClient`)
- [ ] Create `src/lib/supabase/server.ts` — server client (`createServerClient` with cookies)
- [ ] Create `src/lib/supabase/middleware.ts` — middleware client (refresh session)
- [ ] Create `src/middleware.ts` — Next.js middleware (protect `/settings/*`, `/campaigns/*/edit`, `/scenarios/*/edit`, `/scenarios/new`, `/campaigns/new`)

### 1.6 — Auth pages

- [ ] Create `src/app/(auth)/login/page.tsx` — email/password form + Google OAuth button
- [ ] Create `src/app/(auth)/register/page.tsx` — email/password registration form
- [ ] Create `src/app/(auth)/forgot-password/page.tsx` — password reset request form
- [ ] Create `src/app/(auth)/auth/callback/route.ts` — OAuth callback handler
- [ ] Create `src/app/(auth)/auth/confirm/route.ts` — email confirmation handler
- [ ] Add Zod validation schemas for login/register forms in `src/lib/validations/auth.ts`

### 1.7 — Layout shell

- [ ] Create `src/components/layout/Navbar.tsx` — logo, nav links (Browse, Official, Rules), auth dropdown (login/register or avatar+menu)
- [ ] Create `src/components/layout/Footer.tsx` — links, copyright
- [ ] Update `src/app/layout.tsx` — wrap with Navbar, Footer, Toaster
- [ ] Create `src/app/(public)/page.tsx` — landing/home page (hero, featured scenarios placeholder)

### 1.8 — Deploy to Vercel

- [ ] Connect GitHub repo to Vercel
- [ ] Set environment variables on Vercel (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL)
- [ ] Verify deploy succeeds and auth flow works in production

### 1.9 — Verify Phase 1

- [ ] Register with email → confirm email → login works
- [ ] Login with Google OAuth works
- [ ] Forgot password sends reset email
- [ ] Navbar shows authenticated state (avatar/dropdown) after login
- [ ] Protected routes redirect to `/login` when unauthenticated
- [ ] Logout works and clears session

---

## Phase 2: Database Schema & Supabase Setup

### 2.1 — SQL migration

- [ ] Create `supabase/migrations/001_initial_schema.sql` with:
  - [ ] Enums: `section_type`, `target_type`
  - [ ] Table: `profiles` (id FK auth.users, username UNIQUE, display_name, avatar_url, bio, total_storage_used_bytes DEFAULT 0, is_premium DEFAULT false, created_at, updated_at)
  - [ ] Table: `game_systems` (id, name, slug UNIQUE, description, icon_url, created_at)
  - [ ] Table: `campaigns` (id, author_id FK profiles, game_system_id FK, title, slug UNIQUE, description, cover_image_url, is_published DEFAULT false, is_official DEFAULT false, created_at, updated_at)
  - [ ] Table: `scenarios` (id, campaign_id FK campaigns NULLABLE, author_id FK profiles, game_system_id FK, title, slug UNIQUE, description, story_text, map_data JSONB, player_count_min, player_count_max, tags text[], sort_order, is_published DEFAULT false, created_at, updated_at)
  - [ ] Table: `scenario_sections` (id, scenario_id FK, section_type enum, title, content JSONB, sort_order)
  - [ ] Table: `event_tables` (id, scenario_id FK, title, description, entries JSONB)
  - [ ] Table: `uploaded_files` (id, user_id FK profiles, scenario_id FK NULLABLE, storage_path, file_name, file_size_bytes, mime_type, is_temporary DEFAULT true, created_at)
  - [ ] Table: `votes` (id, user_id FK, target_type enum, target_id UUID, value SMALLINT CHECK -1/+1, UNIQUE(user_id, target_type, target_id))
  - [ ] Table: `favorites` (id, user_id FK, target_type enum, target_id UUID, created_at, UNIQUE(user_id, target_type, target_id))
  - [ ] Table: `comments` (id, user_id FK, target_type enum, target_id UUID, parent_id FK comments NULLABLE, body TEXT, created_at, updated_at)
  - [ ] Indexes on: slugs, author_id, campaign_id, scenario_id, target_type+target_id, is_published, created_at

### 2.2 — Triggers & functions

- [ ] Create `handle_new_user()` trigger → auto-insert into `profiles` on `auth.users` INSERT
- [ ] Create `check_user_storage_quota(user_id UUID, new_file_size BIGINT)` function → returns boolean
- [ ] Create `update_storage_used()` trigger → update `profiles.total_storage_used_bytes` on uploaded_files INSERT/DELETE
- [ ] Create `get_vote_count(target_type, target_id)` function → returns net vote count

### 2.3 — RLS policies

- [ ] `profiles`: anyone can read; user can update own row
- [ ] `game_systems`: anyone can read; only service_role can write
- [ ] `campaigns`: anyone can read where `is_published = true`; author can CRUD own; service_role can set `is_official`
- [ ] `scenarios`: anyone can read where `is_published = true`; author can CRUD own
- [ ] `scenario_sections`: follow parent scenario's permissions
- [ ] `event_tables`: follow parent scenario's permissions
- [ ] `uploaded_files`: user can read/delete own; insert with quota check
- [ ] `votes`: auth'd users can insert/delete own; anyone can read
- [ ] `favorites`: auth'd users can insert/delete own; user can read own
- [ ] `comments`: anyone can read; auth'd users can insert; user can update/delete own

### 2.4 — Storage buckets

- [ ] Create `scenario-assets` bucket (public read, authenticated write, 5MB file size limit)
- [ ] Create `avatars` bucket (public read, authenticated write, 2MB file size limit)
- [ ] Write bucket policies matching RLS rules

### 2.5 — Seed data

- [ ] Create `supabase/seed/001_game_systems.sql` — insert "Trench Crusade" game system
- [ ] Run migration: `supabase db push` (or `supabase migration up` locally)

### 2.6 — Type generation

- [ ] Run `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
- [ ] Create typed Supabase client wrapper using generated types

### 2.7 — Verify Phase 2

- [ ] Register a new user → verify `profiles` row auto-created
- [ ] Insert seed game system → verify readable without auth
- [ ] Create scenario as user A → verify user B cannot edit it
- [ ] Unpublished scenarios not visible to anonymous users
- [ ] Upload file → verify storage quota updated
- [ ] Upload past 50MB quota → verify rejection

---

## Phase 3: Sanity CMS for Official Content

### 3.1 — Initialize Sanity

- [ ] `cd sanity && sanity init` — project name: forgotten-letters, dataset: production
- [ ] Add Sanity project ID and dataset to `.env.local`
- [ ] `npm install next-sanity @sanity/image-url @portabletext/react`

### 3.2 — Sanity schemas

- [ ] Create `sanity/schemas/gameSystem.ts` — name, slug, description, icon
- [ ] Create `sanity/schemas/officialScenario.ts` — title, slug, gameSystem ref, story (portable text), map image, sections, player count, tags
- [ ] Create `sanity/schemas/rulesPage.ts` — title, slug, gameSystem ref, body (portable text), sort order
- [ ] Create `sanity/schemas/newsPost.ts` — title, slug, body, author string, publishedAt datetime
- [ ] Register all schemas in `sanity/schemas/index.ts`

### 3.3 — Sanity client in Next.js

- [ ] Create `src/lib/sanity/client.ts` — configured Sanity client
- [ ] Create `src/lib/sanity/queries.ts` — GROQ queries for rules, official scenarios, news
- [ ] Create `src/lib/sanity/image.ts` — image URL builder helper

### 3.4 — Public pages

- [ ] Create `src/app/(public)/rules/page.tsx` — list rules pages by game system
- [ ] Create `src/app/(public)/rules/[slug]/page.tsx` — single rules page with portable text
- [ ] Create `src/app/(public)/official/page.tsx` — list official scenarios
- [ ] Create `src/app/(public)/official/[slug]/page.tsx` — single official scenario view

### 3.5 — Revalidation

- [ ] Create `src/app/api/sanity/revalidate/route.ts` — webhook handler for on-demand ISR
- [ ] Configure webhook in Sanity dashboard → Vercel API route URL

### 3.6 — Verify Phase 3

- [ ] Run Sanity Studio locally (`cd sanity && sanity dev`) on port 3333
- [ ] Create a rules page in Studio → verify it appears on site
- [ ] Create an official scenario in Studio → verify it appears on `/official`
- [ ] Edit content in Studio → trigger webhook → verify updated on site

---

## Phase 4: Campaign & Scenario CRUD

### 4.1 — Validation schemas

- [ ] Create `src/lib/validations/campaign.ts` — Zod schema for campaign create/edit
- [ ] Create `src/lib/validations/scenario.ts` — Zod schema for scenario create/edit (basic info, sections, event tables)

### 4.2 — Server actions

- [ ] Create `src/lib/actions/campaigns.ts` — createCampaign, updateCampaign, deleteCampaign, duplicateCampaign
- [ ] Create `src/lib/actions/scenarios.ts` — createScenario, updateScenario, deleteScenario, duplicateScenario, publishScenario

### 4.3 — Campaign pages

- [ ] Create `src/app/(protected)/campaigns/new/page.tsx` — campaign creation form
- [ ] Create `src/app/(public)/campaigns/[slug]/page.tsx` — public campaign view (header + list of scenarios)
- [ ] Create `src/app/(protected)/campaigns/[slug]/edit/page.tsx` — edit campaign (author-only)

### 4.4 — Scenario pages

- [ ] Create `src/app/(protected)/scenarios/new/page.tsx` — tabbed/multi-step creation form
- [ ] Create `src/app/(public)/scenarios/[slug]/page.tsx` — public scenario view (map, story, sections, event tables)
- [ ] Create `src/app/(protected)/scenarios/[slug]/edit/page.tsx` — edit scenario (author-only)

### 4.5 — Scenario form components

- [ ] Create `src/components/scenario-form/BasicInfoTab.tsx` — title, description, game system picker, player count range, tags input
- [ ] Create `src/components/scenario-form/StoryTab.tsx` — Tiptap rich text editor (`npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder`)
- [ ] Create `src/components/scenario-form/SectionsTab.tsx` — dynamic add/remove section cards (type selector, title, content editor)
- [ ] Create `src/components/scenario-form/EventTablesTab.tsx` — dynamic table builder (add/remove rows: roll range, effect, description)
- [ ] Create `src/components/scenario-form/PublishTab.tsx` — preview toggle, publish button

### 4.6 — Duplicate scenario

- [ ] Add "Duplicate" button on scenario view page
- [ ] Implement deep-copy server action (scenario + sections + event tables, new author, unpublished)

### 4.7 — Verify Phase 4

- [ ] Create a campaign with multiple scenarios → verify all saved
- [ ] Edit a scenario → verify changes persist
- [ ] Duplicate a scenario → verify deep copy with new slug
- [ ] Delete a scenario → verify cascade (sections, event tables removed)
- [ ] View published scenario as unauthenticated user → renders correctly
- [ ] Attempt to edit another user's scenario → redirected/blocked

---

## Phase 5: 2D Map Editor

### 5.1 — Setup

- [ ] `npm install react-konva konva`
- [ ] Create `src/app/(protected)/scenarios/[slug]/edit/map/page.tsx` — map editor page wrapper

### 5.2 — Core editor

- [ ] Create `src/components/map-editor/MapEditor.tsx` — main component (Stage, Layer, grid overlay)
- [ ] Create `src/components/map-editor/hooks/useMapEditor.ts` — state management (shapes, selected item, tool mode)
- [ ] Create `src/components/map-editor/hooks/useUndoRedo.ts` — undo/redo stack for map state
- [ ] Implement pan (drag canvas) and zoom (scroll wheel) with clamp limits

### 5.3 — Shape tools

- [ ] Create `src/components/map-editor/Toolbar.tsx` — tool buttons (select, rectangle, circle, line, polygon, text, image, deployment zone, eraser)
- [ ] Create `src/components/map-editor/ShapeLibrary.tsx` — sidebar palette of predefined terrain shapes (buildings, ruins, trenches, forests, hills, rivers, roads)
- [ ] Implement drag-from-palette-to-canvas for predefined shapes
- [ ] Implement color/fill picker for selected shapes
- [ ] Create `src/components/map-editor/PropertiesPanel.tsx` — edit selected shape properties (position, size, rotation, color, label)

### 5.4 — Image import

- [ ] Create `src/lib/actions/upload.ts` — file upload server action with:
  - [ ] File size validation (max 5MB)
  - [ ] MIME type validation (image/png, image/jpeg, image/webp, image/svg+xml)
  - [ ] Storage quota check before upload
  - [ ] Upload to `scenario-assets` bucket
  - [ ] Insert record in `uploaded_files` with `is_temporary = true`
  - [ ] Update `profiles.total_storage_used_bytes`
- [ ] Image upload button in toolbar → upload → place on canvas at center → resize/rotate handles

### 5.5 — Layers

- [ ] Create `src/components/map-editor/LayersPanel.tsx` — list layers, drag to reorder, toggle visibility, lock/unlock, rename

### 5.6 — Deployment zones

- [ ] Implement colored rectangular overlays per player (Player 1: blue, Player 2: red, etc.)
- [ ] Label each zone with player number

### 5.7 — Save / Load / Export

- [ ] Save: serialize Konva stage → JSON → update `scenarios.map_data` via server action
- [ ] Load: on page mount, read `scenarios.map_data` → restore Konva stage from JSON
- [ ] Mark all `is_temporary` uploaded images as permanent on save
- [ ] Export: "Download PNG" button using `stage.toDataURL()`

### 5.8 — Temp file cleanup

- [ ] Create `src/app/api/cron/cleanup-temp-files/route.ts` — deletes `uploaded_files` where `is_temporary = true` AND `created_at < now() - 24h`
- [ ] Also deletes corresponding files from Supabase Storage
- [ ] Updates `profiles.total_storage_used_bytes` accordingly
- [ ] Add cron schedule to `vercel.json`: `"crons": [{ "path": "/api/cron/cleanup-temp-files", "schedule": "0 3 * * *" }]`

### 5.9 — Verify Phase 5

- [ ] Place shapes → save → reload → shapes persist at same positions
- [ ] Upload image → place on map → save → reload → image displays
- [ ] Undo/redo works for all operations
- [ ] Zoom and pan work smoothly
- [ ] Layers panel: reorder, hide, lock all functional
- [ ] Export PNG matches canvas view
- [ ] Upload file exceeding 5MB → rejected with error message
- [ ] Upload past 50MB total quota → rejected with error message
- [ ] Abandon session without saving → temp files cleaned up after 24h

---

## Phase 6: Social Features

### 6.1 — Voting

- [ ] Create `src/components/social/VoteButtons.tsx` — upvote/downvote with optimistic UI
- [ ] Create server action `toggleVote(target_type, target_id, value)` in `src/lib/actions/social.ts`
- [ ] Display net vote count on scenario and campaign cards/pages

### 6.2 — Favorites

- [ ] Create `src/components/social/FavoriteButton.tsx` — bookmark toggle with optimistic UI
- [ ] Create server actions `toggleFavorite`, `getFavorites` in `src/lib/actions/social.ts`
- [ ] Create `src/app/(protected)/profile/favorites/page.tsx` — list user's favorited items

### 6.3 — Comments

- [ ] Create `src/components/social/CommentThread.tsx` — threaded comments (top-level + replies)
- [ ] Create `src/components/social/CommentForm.tsx` — markdown textarea + submit
- [ ] Create server actions `createComment`, `deleteComment`, `getComments` in `src/lib/actions/social.ts`
- [ ] Render comments on scenario and campaign view pages

### 6.4 — Share

- [ ] Create `src/components/social/ShareButton.tsx` — "Copy link" button (clipboard API)
- [ ] Add Open Graph meta tags to scenario/campaign pages (`generateMetadata`)
- [ ] Verify link previews work on Discord, Twitter, etc.

### 6.5 — Public profiles

- [ ] Create `src/app/(public)/user/[username]/page.tsx` — display name, bio, avatar, join date
- [ ] List authored campaigns and scenarios (published only)
- [ ] Show total votes received and scenario count

### 6.6 — Browse & search

- [ ] Create `src/app/(public)/scenarios/page.tsx` — browse all published scenarios
- [ ] Filters: game system dropdown, player count range, tags multi-select
- [ ] Sort: newest, top-voted, most favorited
- [ ] Search: text input filtering by title/description (Supabase `ilike` or full-text search)
- [ ] Pagination (cursor-based or offset)
- [ ] Create `src/app/(public)/campaigns/page.tsx` — browse all published campaigns (similar filters)

### 6.7 — Verify Phase 6

- [ ] Upvote a scenario → refresh → vote persists and count is correct
- [ ] Switch vote from up to down → count updates
- [ ] Favorite a scenario → appears in `/profile/favorites`
- [ ] Unfavorite → removed from list
- [ ] Post a comment → appears immediately
- [ ] Reply to a comment → threaded correctly
- [ ] Delete own comment → removed
- [ ] Cannot delete another user's comment
- [ ] Share link → copied to clipboard → paste shows correct URL
- [ ] Link preview on Discord/Twitter shows title, description, and thumbnail
- [ ] Public profile shows correct user info and scenarios
- [ ] Browse page: filters, sort, and search all return correct results

---

## Phase 7: Account Management & Settings

### 7.1 — Profile settings

- [ ] Create `src/app/(protected)/settings/layout.tsx` — settings sidebar nav (Profile, Account, Storage)
- [ ] Create `src/app/(protected)/settings/profile/page.tsx` — edit display name, username, bio
- [ ] Avatar upload component → upload to `avatars` bucket → update `profiles.avatar_url`

### 7.2 — Account settings

- [ ] Create `src/app/(protected)/settings/account/page.tsx`
- [ ] Change email (Supabase `updateUser({ email })`)
- [ ] Change password (Supabase `updateUser({ password })`)
- [ ] Delete account (confirmation dialog → delete profile + cascaded data → sign out)

### 7.3 — Storage dashboard

- [ ] Create `src/app/(protected)/settings/storage/page.tsx`
- [ ] Show usage bar: `total_storage_used_bytes / 50MB` with percentage
- [ ] List uploaded files (name, size, date, linked scenario) with delete button
- [ ] Delete file → remove from storage bucket → update quota → remove DB record

### 7.4 — Verify Phase 7

- [ ] Update profile → changes reflected on public profile page
- [ ] Upload new avatar → appears in navbar and profile
- [ ] Change email → confirmation email sent → new email works
- [ ] Change password → can log in with new password
- [ ] Storage bar shows correct usage after uploads/deletes
- [ ] Delete file from storage dashboard → quota freed → file gone from bucket
- [ ] Delete account → all user data removed → redirected to home

---

## Phase 8: Polish & Launch Prep

### 8.1 — Error handling & UX

- [ ] Add loading skeletons for all data-fetching pages
- [ ] Add `error.tsx` boundary files for each route group
- [ ] Add `not-found.tsx` for scenarios, campaigns, users that don't exist
- [ ] Create `src/app/not-found.tsx` — global 404 page
- [ ] Add toast notifications for all mutations (save, delete, vote, etc.)
- [ ] Add confirmation dialogs for destructive actions (delete scenario, delete account)

### 8.2 — Responsive design

- [ ] Navbar: hamburger menu on mobile
- [ ] Browse/search pages: stack filters vertically on mobile
- [ ] Scenario view: readable on mobile
- [ ] Map editor: show "desktop recommended" banner on small screens
- [ ] Settings pages: collapsible sidebar on mobile

### 8.3 — SEO

- [ ] Add `generateMetadata()` to all public pages (title, description, OG image)
- [ ] Create `src/app/sitemap.ts` — dynamic sitemap for published scenarios/campaigns
- [ ] Create `src/app/robots.ts` — allow all crawlers
- [ ] Add structured data (JSON-LD) for scenarios (name, description, author)

### 8.4 — Security & rate limiting

- [ ] `npm install @upstash/ratelimit @upstash/redis` (or use Vercel KV)
- [ ] Add rate limiting to: auth endpoints, comment creation, vote toggling, file uploads
- [ ] Sanitize user-submitted markdown/HTML in comments and stories (prevent XSS)
- [ ] Verify all RLS policies are tight (re-test with different user roles)
- [ ] Add CSRF protection headers

### 8.5 — Moderation (basic)

- [ ] Add "Report" button on scenarios, campaigns, and comments
- [ ] Create `reports` table (id, reporter_id, target_type, target_id, reason, created_at)
- [ ] Admin page or Supabase dashboard query to review reports

### 8.6 — Analytics & monitoring

- [ ] `npm install @vercel/analytics @vercel/speed-insights`
- [ ] Add analytics components to root layout
- [ ] Set up Vercel error tracking (or Sentry free tier)

### 8.7 — Final documentation

- [ ] Update `README.md` with final setup instructions
- [ ] Document all env vars in `.env.example` with comments
- [ ] Update `docs/Techstack.md` with final dependencies
- [ ] Write `CONTRIBUTING.md` if accepting contributions

### 8.8 — Verify Phase 8

- [ ] All pages load without console errors
- [ ] Lighthouse scores: Performance > 80, Accessibility > 90, SEO > 90
- [ ] Mobile testing on phone/tablet — no broken layouts
- [ ] Rate limiting triggers after spam attempts
- [ ] XSS payloads in comments/stories are sanitized
- [ ] 404 pages render correctly for invalid URLs
- [ ] Analytics events appearing in Vercel dashboard
- [ ] Production deploy stable on Vercel

---

## Post-Launch (v2 Backlog)

- [ ] Premium tier with Stripe (increased storage, priority features)
- [ ] Real-time collaboration on map editor (Supabase Realtime)
- [ ] Scenario versioning / edit history
- [ ] Notifications (new comments, votes on your scenarios)
- [ ] Admin dashboard (manage users, official content flags, moderation queue)
- [ ] Additional game systems beyond Trench Crusade
- [ ] Scenario PDF export
- [ ] Campaign play tracker (session log)