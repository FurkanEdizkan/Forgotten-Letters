# Sprint 5 — Map Editor & Campaign Tracking

> Goal: ship the two heaviest features in parallel — the canvas-based map
> editor (Phase 5/H3) and warband campaign tracking with match logging
> (Phase D). They share no code, so two contributors can move independently.
>
> Phases included: **5/H3, D**.

---

## Phase 5 / H3 — Map Editor

### 5.1 Setup

- [ ] `npm i react-konva konva`
- [ ] Page: `src/app/(protected)/scenarios/[slug]/edit/map/page.tsx` — dynamic import the editor with `{ ssr: false }`
- [ ] `src/types/map.ts` — `MapData` interface (version 1; canvas {width,height,gridSize,gridVisible,backgroundColor}; layers[]; shapes[] with type union `rect|circle|polygon|line|text|image|deploymentZone` plus type-specific fields)

### 5.2 Store

- [ ] `src/lib/stores/map-editor-store.ts` (Zustand) — shapes, layers, selection, tool, history (max 50 ops), zoom/pan
- [ ] Command pattern for undo/redo

### 5.3 Components

- [ ] `MapEditor.tsx` — orchestrator
- [ ] `Canvas.tsx` — Konva Stage + Layer rendering
- [ ] `ShapeRenderer.tsx` — switch on shape type
- [ ] `Toolbar.tsx` — tools (V/R/C/P/L/T/I/D/E + Pan + Undo/Redo + zoom)
- [ ] `LayerPanel.tsx` — list, drag-reorder, visibility, lock, rename
- [ ] `PropertiesPanel.tsx` — selected shape props
- [ ] `AssetLibrary.tsx` — preset terrain shapes + uploaded images
- [ ] `DeploymentZone.tsx` — translucent zones with player labels
- [ ] `GridOverlay.tsx` — toggleable grid with snap-to-grid (8 px tolerance)
- [ ] `ZoomControls.tsx` — zoom +/-, reset, fit-to-screen

### 5.4 Image upload integration

- [ ] Toolbar "I" → file picker → calls `processUpload(file, { scenarioId, kind: 'map' })` from H1
- [ ] Auto-resize >1024 px before placement
- [ ] Max 10 images per map (count from `uploaded_files` filtered by scenario)

### 5.5 Save / Load / Export

- [ ] `saveMapData(scenarioId, mapData)` server action — validates ≤ 500 KB JSONB, validates shape with Zod, upserts `scenarios.map_data`
- [ ] On save: flip relevant `uploaded_files.is_temporary` to false
- [ ] Auto-save every 30 s; explicit "Save" button always enabled
- [ ] Load: hydrate store from `scenarios.map_data` on mount
- [ ] Export PNG: `stage.toDataURL()` — apply "Made with Forgotten Letters" watermark text overlay for free tier (premium removes it)

### 5.6 UX details (cover the gaps)

- [ ] Snap-to-grid behaviour (toggleable)
- [ ] Alignment guides while dragging (vertical/horizontal)
- [ ] Multi-select via shift-click + drag-rect
- [ ] Copy / Paste / Duplicate (Ctrl+C / V / D) — clipboard in store
- [ ] Keyboard nudge: arrow keys = 1 px, Shift+arrow = 10 px
- [ ] Mobile detection → "Map editor requires a desktop browser" banner

### 5.7 Verify

- [ ] 5+ shapes across 3 layers — save → reload → layout intact
- [ ] Undo/redo works for 10+ operations
- [ ] Export PNG matches canvas including watermark
- [ ] Map JSONB stays under 500 KB for a complex map (write a test)
- [ ] Bundle: confirm Konva is **not** in the main route bundle (visit `/scenarios/[slug]` and inspect network)

---

## Phase D — Campaign Tracking

### D.1 Pages

- [ ] `src/app/(protected)/warbands/[id]/campaign/page.tsx` — overview
- [ ] `src/app/(protected)/warbands/[id]/campaign/log-match/page.tsx` — log match form

### D.2 Components

- [ ] `CampaignOverview.tsx` — W/L/D, glory, treasury
- [ ] `MatchCard.tsx`
- [ ] `MatchForm.tsx` — opponent (free text or autocomplete public warbands), result, scenario picker (autocomplete), date, notes, glory/ducats earned
- [ ] `InjuryRoller.tsx` — interactive table from Sanity `campaignTable`
- [ ] `AdvancementRoller.tsx`

### D.3 Server actions

- [ ] `logMatch(warbandId, data)` — validate, insert match, update `campaign_state` counters, fire `increment_play_count(scenario_id)` if linked
- [ ] `applyInjury(unitId, injury)` / `applyAdvancement(unitId, advancement)`
- [ ] `markUnitDead(unitId)`

### D.4 Per-unit progress

- [ ] On match save, prompt for casualties → roll injuries → apply
- [ ] Eligible units → roll advancements → apply
- [ ] Display `unit_campaign_progress` (XP, advancements, injuries, kills) on warband builder when in campaign mode

### D.5 PDF roster export

- [ ] `npm i @react-pdf/renderer`
- [ ] `src/lib/pdf/warband-roster.tsx` — React-PDF document with units, equipment, points, campaign state
- [ ] Server action `exportWarbandPdf(warbandId)` returns binary; route `src/app/api/warbands/[id]/pdf/route.ts` streams it
- [ ] Free tier: footer watermark; premium: clean

### D.6 Verify

- [ ] Log a match linked to a published scenario → match appears, scenario `play_count` increments, campaign W/L updates
- [ ] Apply an injury → persists across reload
- [ ] PDF download renders the warband legibly with footer watermark
- [ ] User can't log a match against another user's private warband

---

## Sprint 5 — Verify

- [ ] Build a complete scenario: text + sections + event tables + map → publish
- [ ] Build a campaign warband, log 3 matches against the scenario → "Most Played" sort surfaces the scenario
- [ ] Map editor and campaign log both function on a phone (campaign log only — map shows the desktop banner)
