# Sprint 4 — Scenario/Campaign CRUD, Warband Builder, Search

> Goal: end-to-end content creation and discovery work for scenarios,
> campaigns, and warbands (everything except the map editor and campaign
> tracking, which arrive in Sprint 5).
>
> Phases included: **4, C, H2, G5**.

---

## Phase 4 — Scenario & Campaign CRUD

### 4.1 Validation schemas

- [ ] `src/lib/validations/campaign.ts`
- [ ] `src/lib/validations/scenario.ts` — basic info, sections, event tables (use discriminated union per section_type)

### 4.2 Server actions

- [ ] `src/lib/actions/campaigns.ts` — create / update / delete / duplicate
- [ ] `src/lib/actions/scenarios.ts` — create / update / delete / duplicate / publish (toggles `is_published`)
- [ ] Duplicate is deep-copy: scenario + sections + event_tables; new author, new slug, `is_published=false`

### 4.3 Pages

- [ ] `src/app/(protected)/campaigns/new/page.tsx`
- [ ] `src/app/(protected)/campaigns/[slug]/edit/page.tsx`
- [ ] `src/app/(public)/campaigns/[slug]/page.tsx`
- [ ] `src/app/(protected)/scenarios/new/page.tsx` (multi-tab)
- [ ] `src/app/(protected)/scenarios/[slug]/edit/page.tsx`
- [ ] `src/app/(public)/scenarios/[slug]/page.tsx`

### 4.4 Form components

- [ ] `npm i @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder`
- [ ] `src/components/scenario-form/BasicInfoTab.tsx`
- [ ] `src/components/scenario-form/StoryTab.tsx` — Tiptap editor
- [ ] `src/components/scenario-form/SectionsTab.tsx`
- [ ] `src/components/scenario-form/EventTablesTab.tsx`
- [ ] `src/components/scenario-form/PublishTab.tsx`
- [ ] **Autosave** — every 20s save a draft to `localStorage` keyed by scenario id; restore on mount with confirm prompt (closes the autosave gap)

### 4.5 Duplicate UX

- [ ] "Duplicate" button on view page (auth users only)
- [ ] **Fork attribution** — store `duplicated_from_scenario_id` on scenarios; show "Forked from {original}" badge; add nullable column in `015_add_play_count_and_reconcile.sql` (Sprint 8 / S2)
  > For now add the column in this sprint with its own migration if convenient, otherwise carry it in the S2 reconcile file.

### 4.6 Verify

- [ ] Create campaign → add scenarios → all persist
- [ ] Edit scenario → changes persist
- [ ] Duplicate → deep copy with new slug
- [ ] Delete scenario → sections + event_tables cascade-removed
- [ ] Anonymous can view a published scenario
- [ ] User B cannot reach `/scenarios/{B-of-A's}/edit`

---

## Phase C — Warband Builder UI (parallel with Phase 4)

### C.1 Pages

- [ ] `src/app/(protected)/warbands/page.tsx` — "My warbands" dashboard
- [ ] `src/app/(protected)/warbands/new/page.tsx` — game → faction → name → points → confirm
- [ ] `src/app/(protected)/warbands/[id]/page.tsx` — main builder
- [ ] `src/app/(public)/warbands/[id]/view/page.tsx` — read-only public view (only when `is_public`)

### C.2 Components

- [ ] `WarbandHeader.tsx`, `UnitCard.tsx`, `UnitCatalogue.tsx`, `EquipmentSelector.tsx`, `PointsTracker.tsx`, `WarbandCard.tsx`, `ValidationWarnings.tsx`

### C.3 Server actions

- [ ] `src/lib/actions/warband.ts` — `createWarband`, `updateWarband`, `deleteWarband`, `duplicateWarband`, `addUnit`, `removeUnit`, `updateUnitEquipment`, `toggleWarbandPublic`, `upgradeRulesVersion`
- [ ] All actions snapshot `rules_version` from Sanity at relevant moments

### C.4 Validation

- [ ] `src/lib/validations/warband.ts` — `createWarbandSchema`, `addUnitSchema`, `updateEquipmentSchema`

### C.5 Client state

- [ ] `npm i zustand`
- [ ] `src/lib/stores/warband-builder-store.ts` — local roster + dirty flag + autosave on change (debounced 30s)

### C.6 Verify

- [ ] Adding/removing equipment updates `total_points` live and on reload
- [ ] Over-points warning shows
- [ ] Public toggle: `/view` URL works only when `is_public = true`
- [ ] 6th warband for free user blocked at server action layer (matches DB trigger)

---

## Phase H2 — Search & Discovery

### H2.1 Migration `014_add_search_indexes.sql`

- [ ] Add generated `search_vector tsvector` to `scenarios`, `campaigns`, `warbands` (title weight A, description/name weight B)
- [ ] GIN indexes on each
- [ ] Composite indexes for browse: `(game_system_id, is_published, created_at DESC)`, `(vote_count DESC, created_at DESC)`, `(play_count DESC, created_at DESC)`
- [ ] Materialized view or computed column for `vote_count` per `(target_type, target_id)` if EXPLAIN shows hot path; otherwise just an index on votes

### H2.2 Browse pages

- [ ] `src/app/(public)/scenarios/page.tsx`
- [ ] `src/app/(public)/campaigns/page.tsx`
- [ ] `src/app/(public)/warbands/page.tsx` (only `is_public = true`)

### H2.3 Search components

- [ ] `npm i nuqs`
- [ ] `src/components/search/SearchBar.tsx` — debounced 300 ms
- [ ] `src/components/search/FilterBar.tsx` — game system, players, tags
- [ ] `src/components/search/SortSelect.tsx` — Popular / Newest / Most Played / Relevance
- [ ] `src/components/search/TagFilter.tsx`
- [ ] `src/components/search/ScenarioGrid.tsx` — infinite scroll via Intersection Observer + cursor pagination

### H2.4 Server actions / loaders

- [ ] `src/lib/queries/search.ts` — typed wrappers around Supabase RPC for full-text + filters
- [ ] All public browse queries enforce `is_published = true AND is_hidden = false`

### H2.5 Verify

- [ ] `?q=siege&game=trench-crusade&players=2&sort=popular&tags=urban,narrative` URL is shareable and reproducible
- [ ] EXPLAIN on the main browse query shows the GIN + composite indexes are used
- [ ] Hidden content does not appear for anon or regular users; admin sees it

---

## Phase G5 — Vercel configuration (parallel)

- [ ] `vercel.json` — `crons` (cleanup-temp), `ignoreCommand` for docs-only
- [ ] Preview deploy password protection turned on
- [ ] Production env vars locked down (no service-role key in preview)
- [ ] `next.config.ts` — image domains for Supabase + Sanity CDNs

---

## Sprint 4 — Verify

- [ ] A logged-in user can create a campaign, three scenarios under it, edit one, duplicate one, publish all three
- [ ] Anon user can browse, search, sort, paginate, and reach a public scenario
- [ ] Warband builder can build a faction warband within points limit, mark it public, and visit the public view URL in a private window
- [ ] Hitting "Most Played" sort returns scenarios ordered by `play_count` (currently 0 for all — sprint 5 will populate)
