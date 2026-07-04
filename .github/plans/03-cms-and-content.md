# Sprint 3 — CMS & Content

> Goal: Sanity is set up, schemas exist for both editorial content (rules,
> news, official scenarios) and warband rules data (factions, units,
> equipment), and the image pipeline (compress + thumbnail + temp cleanup) is
> live so later sprints can rely on it.
>
> Phases included: **3, A, H1**.

---

## Phase 3 — Sanity (editorial)

### 3.1 Initialize

- [ ] `cd sanity && sanity init` — project: forgotten-letters, dataset: production (and `staging` dataset for non-prod envs)
- [ ] Add `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN`, `SANITY_REVALIDATION_SECRET` to `.env.local` and Vercel
- [ ] `npm i next-sanity @sanity/image-url @portabletext/react`

### 3.2 Editorial schemas

- [ ] `sanity/schemas/gameSystem.ts`
- [ ] `sanity/schemas/officialScenario.ts`
- [ ] `sanity/schemas/rulesPage.ts`
- [ ] `sanity/schemas/newsPost.ts`
- [ ] `sanity/schemas/legalDocument.ts` — title, slug (`terms` / `privacy` / `dmca` / `cookies`), body (portable text), updatedAt — used by Sprint 8
- [ ] Register in `sanity/schemas/index.ts`

### 3.3 Next.js client

- [ ] `src/lib/sanity/client.ts`
- [ ] `src/lib/sanity/queries.ts` — `getRulesPages`, `getRulesPage(slug)`, `getOfficialScenarios`, `getOfficialScenario(slug)`, `getNewsPosts`, `getLegalDocument(slug)`
- [ ] `src/lib/sanity/image.ts` — image URL builder

### 3.4 Public pages

- [ ] `src/app/(public)/rules/page.tsx`
- [ ] `src/app/(public)/rules/[slug]/page.tsx`
- [ ] `src/app/(public)/official/page.tsx`
- [ ] `src/app/(public)/official/[slug]/page.tsx`
- [ ] `src/app/(public)/news/page.tsx` (list)
- [ ] `src/app/(public)/news/[slug]/page.tsx`

### 3.5 Revalidation

- [ ] `src/app/api/sanity/revalidate/route.ts` — verifies `SANITY_REVALIDATION_SECRET` signature header before calling `revalidateTag`/`revalidatePath`
- [ ] Configure Sanity webhook → this URL with the secret

### 3.6 Verify

- [ ] `cd sanity && sanity dev` runs at :3333
- [ ] Create a rules page in Studio → appears at `/rules/<slug>`
- [ ] Edit content → webhook fires → page updates within seconds

---

## Phase A — Sanity warband rules schemas (parallel with 3.2)

- [ ] `sanity/schemas/rulesVersion.ts`
- [ ] `sanity/schemas/faction.ts`
- [ ] `sanity/schemas/unitType.ts`
- [ ] `sanity/schemas/equipment.ts`
- [ ] `sanity/schemas/ability.ts`
- [ ] `sanity/schemas/campaignTable.ts` (injury / advancement / exploration tables)
- [ ] Register all in `sanity/schemas/index.ts`
- [ ] `src/lib/sanity/queries/warband.ts` — `getFactions`, `getUnitsByFaction`, `getEquipmentForUnit`, `getCampaignTables`, `getLatestRulesVersion`, `getRulesVersionHistory`
- [ ] Seed Studio with one faction + 3–5 units + 5–10 equipment items + 1 of each campaign table for E2E and dev work
- [ ] Verify GROQ queries return seeded data with version filtering

---

## Phase H1 — Image pipeline

### H1.1 Upload action

- [ ] `npm i sharp`
- [ ] `src/lib/actions/upload.ts` exporting `processUpload(file, { scenarioId?, kind })`:
  - validate size ≤ 5 MB and mime ∈ {jpeg, png, webp}
  - quota check via `check_user_storage_quota`
  - upload original to `temp/{userId}/{uuid}` in `scenario-assets`
  - sharp → WebP @ q80 → permanent path
  - sharp → 300px WebP @ q60 → `thumbs/`
  - delete temp file on success
  - INSERT `uploaded_files` row (`is_temporary = true` until scenario save)
- [ ] Reuse for avatars (kind `avatar`, target bucket `avatars`, output 200×200 WebP)

### H1.2 Storage paths (canonical)

```
scenario-assets/
  temp/{userId}/{uuid}
  scenarios/{scenarioId}/{filename}.webp
  scenarios/{scenarioId}/thumbs/{filename}.webp
  maps/{scenarioId}/{filename}.webp
avatars/
  {userId}.webp
```

### H1.3 Temp cleanup cron

- [ ] `src/app/api/cron/cleanup-temp/route.ts` — verifies `CRON_SECRET`, deletes files in `temp/` older than 24h plus matching `uploaded_files` rows where `is_temporary = true`
- [ ] Add to `vercel.json` crons: `{ path: "/api/cron/cleanup-temp", schedule: "0 3 * * *" }`

### H1.4 Verify

- [ ] 4 MB JPEG → produces compressed WebP + thumbnail; original removed from `temp/`
- [ ] 6 MB upload rejected with clear toast
- [ ] User over 50 MB quota → reject with quota message
- [ ] Cron run via curl + secret deletes a 25-hour-old file in temp

---

## Sprint 3 — Verify

- [ ] Both Sanity datasets accessible (production + staging)
- [ ] Webhook signature verified — invalid secret returns 401
- [ ] Seeded faction renders on a stub `/_dev/factions` page (delete after sprint)
- [ ] Image pipeline handles a real avatar upload from the Settings page (stub) and shows the new avatar in the navbar
