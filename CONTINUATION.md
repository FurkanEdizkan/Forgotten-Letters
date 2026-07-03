# Continuation Handoff — Forgotten Letters (for Codex)

> **Status:** Design system + frontend UI shell in progress on branch `feat/design-system-ui-shell`.
> This document is the handoff. Read it top to bottom before writing code.
> Authoritative context files: `PRODUCT.md` (strategy), `DESIGN.md` (visual system), `TODO.md` (full build plan), `README.md` (structure/tech), `docs/Techstack.md`.

---

## 0. TL;DR of what to do next

The **impeccable/design layer** (design tokens, UI primitives, layout shell, landing + auth UI) is being built by hand — Next.js was scaffolded manually, not via `create-next-app`. Your job continuing from here:

1. **The app already installs, typechecks, and builds clean** (verified this session — `npm install`, `npm run typecheck`, `npm run build` all pass; all 7 routes prerender as static). Run `npm run dev` and do a **visual pass** in the browser — the build was verified but the rendered pixels were not screenshotted this session, so eyeball the landing + auth pages first.
2. Finish the remaining **design/UI surfaces** (see §5 "Remaining UI").
3. Then move into the **backend/data phases** (Supabase, Sanity, server actions) per `TODO.md` Phases 2–8, which were intentionally left untouched — they are not "design parts".

---

## 1. What this project is

Community-driven **wargame scenario repository**, starting with **Trench Crusade**. Users build campaigns/scenarios (rich text, event tables, a 2D canvas map editor), publish them, and the community browses/votes/favorites/comments. Official content is CMS-managed. Full feature list in `README.md`; full phased checklist in `TODO.md`.

**Register:** `product` (design serves the tool). **Mood:** "The War Room at Night" — gritty, tactical, grimdark WWI-occult. Dark-first, steel-blue instrument primary + oxblood accent on a near-black tinted field. **Explicitly NOT** a generic cream/sand SaaS dashboard, and NOT cartoonish/playful. See `DESIGN.md` for the full visual doctrine and the Do's/Don'ts.

---

## 2. Tech stack (per README / Techstack.md)

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS **v4** (CSS-first `@theme`, no `tailwind.config.js`) |
| UI primitives | Hand-built in `src/components/ui` (shadcn-style, CVA variants) |
| Auth / DB / Storage | Supabase — **not wired yet** |
| CMS | Sanity — **not wired yet** |
| Map editor | react-konva — **not started** |
| Hosting | Vercel |

Note: `TODO.md` Phase 1.2 originally called for `shadcn/ui` + zinc palette. That was **deliberately overridden** — shadcn's zinc theme is the generic-SaaS look `PRODUCT.md` bans. Primitives are hand-built on the DESIGN.md token system instead. Keep building on these tokens; do not `npx shadcn init` and overwrite them.

---

## 3. Getting it running (DO THIS FIRST)

```bash
# on branch feat/design-system-ui-shell
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit — fix any type errors
npm run lint
```

**Verified this session:** `npm install` (341 pkgs), `npm run typecheck` (clean), `npm run build` (all 7 routes static). Next was bumped `15.1.3 → 15.5.20` via `npm audit fix` to clear a **critical** RCE advisory (CVE-2025-66478 / GHSA-9qr9-h5gf-34mp). Two **moderate** advisories remain (a transitive `postcss` XSS bundled inside Next's own deps); the only npm-offered fix downgrades Next to v9, so it was left — not exploitable in this static build. Revisit when a clean Next patch ships.

**Notes:**
- Font loading: `layout.tsx` uses `next/font/google` (Inter, Oswald, JetBrains Mono). Needs network at build; if a later environment is offline, swap to local fonts or system stacks (the CSS already has fallbacks in the `--font-*` tokens).
- Tailwind v4: styling comes entirely from `src/app/globals.css` (`@import "tailwindcss"` + `@theme`). There is intentionally no `tailwind.config.*`.

---

## 4. What has been built (design layer)

### Foundation
- `package.json`, `tsconfig.json` (`@/*` → `src/*`), `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `next-env.d.ts`.

### Design tokens — `src/app/globals.css`
The full "War Room at Night" palette resolved to **OKLCH** in Tailwind v4 `@theme`:
- Surface: `--color-bg` (near-black steel-tinted), `--color-surface`, `--color-elevated`, `--color-border`, `--color-border-strong`.
- Ink: `--color-ink` (≥7:1), `--color-muted` (≥4.5:1), `--color-faint`.
- Primary (steel-blue): `--color-primary` `oklch(0.65 0.16 250)` + hover/active/ink/soft.
- Accent (oxblood): `--color-accent` `oklch(0.52 0.14 32)` + hover/ink/soft.
- Status: success/warning/danger. Radii (sm/md/lg, tight & tactical). Fonts. Motion easings.
- Base layer: dark color-scheme, faint tactical-grid `body::before`, focus-visible ring, `prefers-reduced-motion` reset. Use `text-*` / `bg-*` / `border-*` utilities — Tailwind v4 generates them from the `@theme` color tokens (e.g. `bg-primary`, `text-muted`, `border-border-strong`).

### UI primitives — `src/components/ui/`
- `Button.tsx` — CVA variants: `primary` (steel), `danger` (oxblood — destructive only), `secondary`, `outline`, `ghost`, `link`; sizes `sm/md/lg/icon`; `asChild` via Radix Slot.
- `Card.tsx` — flat-field card (`interactive` prop adds hover lift + shadow-on-state) + Header/Title/Description/Content/Footer.
- `Input.tsx` — dark field, primary focus glow, `aria-invalid` danger state.
- `Label.tsx` — mono uppercase tactical labels.
- `Badge.tsx` — CVA variants default/neutral/accent/success/warning.

### Layout shell — `src/components/layout/`
- `Navbar.tsx` (client) — sticky, logo, Browse/Official/Rules, active-route highlight, Log in / Enlist, mobile hamburger sheet.
- `Footer.tsx` — repository/create link columns, fan-project disclaimer.
- Both wired into `src/app/layout.tsx` (root layout with font variables + metadata template).

### Pages
- `src/app/(public)/page.tsx` — landing: war-room hero with a signature "map editor readout" panel (not a stat template), capabilities grid, ordered 01/02/03 build-flow (numbers earned — it's a real sequence), CTA.
- `src/app/(auth)/{login,register,forgot-password}/page.tsx` — auth UI on a shared `AuthShell` (presentational; wire to Supabase later). Uses `GoogleButton` + `Divider` in `src/components/auth/`.
- `src/app/(public)/scenarios/page.tsx` — browse: sticky filter rail (search, game-system, player-count, tag pills), sort control, and a responsive grid of `ScenarioCard`s. + `src/app/(public)/scenarios/loading.tsx` skeleton.
- `src/app/not-found.tsx` — on-theme global 404 ("Sector 404 / Off the map").

### More primitives / components
- `src/components/ui/Skeleton.tsx`, `src/components/ui/Textarea.tsx`.
- `src/components/social/ScenarioCard.tsx` — tactical dossier tile (map-grid preview, mono stat counts) + its `ScenarioSummary` type.
- `src/lib/mock/scenarios.ts` — placeholder scenario data + `GAME_SYSTEMS` / `ALL_TAGS`. **Delete once Supabase queries are wired.**

### Utility
- `src/lib/utils/cn.ts` — `clsx` + `tailwind-merge`.

### Visual verification (this session)
Rendered in headless Chrome and eyeballed — landing, `/scenarios`, and `/login` all render on-brand (dark tactical field, Oswald condensed display, steel-blue primary, oxblood accent, mono data). Reference screenshots saved to `docs/design-preview/{landing,scenarios,login}.png`.

---

## 5. Remaining UI (finish these next — still "design parts")

**Not yet started (UI shells to build on the token system):**
- Route-group `error.tsx` files + more `loading.tsx` skeletons (only `/scenarios/loading.tsx` exists).
- Scenario detail view shell `scenarios/[slug]/page.tsx` (map area, story, sections, event tables rendered as mono data).
- Official + Rules list/detail shells `(public)/official`, `(public)/rules`.
- Settings shell `(protected)/settings/*` (sidebar nav: Profile/Account/Storage).
- Scenario/campaign **form** UI `src/components/scenario-form/*` (tabs — presentational first).
- Additional primitives likely needed (`Textarea` + `Skeleton` already exist): `Select`, `Tabs`, `Dialog`, `Toast`, `Avatar`, `DropdownMenu`, `Tooltip`. Build them hand-rolled on the same tokens (or add Radix primitives dep and style them) — **do not** pull in shadcn's default theme. (The browse page currently uses a plain native `<select>` for sort — replace with a styled `Select` when built.)

Design guardrails for all of the above (from `DESIGN.md` §6): no cream/sand surfaces, no gradient text, no `border-left`>1px stripes, no glassmorphism, no identical icon-heading-text card grids, structured/numeric data in the **mono** font, verify contrast on the dark palette, honor `prefers-reduced-motion`.

---

## 6. Backend / data (NOT design — do after UI, per TODO.md)

Left entirely untouched on purpose. Follow `TODO.md` in order:
- **Phase 2** — Supabase schema (`supabase/migrations/001_initial_schema.sql`), triggers, RLS, storage buckets, seed, typegen. Tables/policies are fully specified in TODO.md §2.
- **Phase 3** — Sanity CMS (schemas, client, GROQ, official/rules pages, revalidation webhook).
- **Phase 4** — Campaign/scenario CRUD (Zod validations, server actions, form wiring).
- **Phase 5** — react-konva 2D map editor.
- **Phase 6** — Social (votes/favorites/comments/share/profiles/browse-search).
- **Phase 7** — Account settings + storage dashboard.
- **Phase 8** — Polish, responsive, SEO, security/rate-limiting, moderation, analytics.

`.env.example` exists; fill Supabase + Sanity keys. Local ports: Next 3000, Sanity 3333, Supabase 54321/54322.

---

## 7. Repo conventions

- **Branch:** work continues on `feat/design-system-ui-shell` (branched from `main`). Repo has the `three-tier-git-flow` skill installed (dev→test→main) but tiers aren't set up yet; for now, PR into `main`.
- **Commits:** `conventional-commits` skill is installed — use Conventional Commits (`feat:`, `fix:`, `chore:`, scopes like `feat(ui):`, `feat(landing):`).
- **Skills available** (in `.claude/`, `.agents/`, `.github/skills/`): `impeccable` (design — run `/impeccable audit <file>` or `polish` on UI), `graphify` (knowledge graph — `graphify query "..."` before deep code exploration; a PreToolUse hook enforces this), plus the taste-skills and git-convention skills.
- **graphify:** a knowledge graph of the repo exists in `graphify-out/`. Run `graphify query "<question>"` to orient before reading many files. Re-run `graphify . --update` after adding real `src/` code so the graph reflects the app rather than skill docs.
- Nothing is committed yet — the whole scaffold + design layer is uncommitted working tree on the feature branch.

---

## 8. Known gaps / decisions made

- **No `npm install` run yet** — verify build before trusting anything (§3).
- Fonts via Google Fonts CDN at build; swap to local if offline.
- shadcn/ui intentionally skipped in favor of hand-built tokened primitives (§2).
- Auth pages are **UI-only**; Supabase auth wiring is Phase 1.3–1.6 / Phase 2.
- The landing "map editor" panel is a static decorative mock, not the real react-konva editor (Phase 5).
