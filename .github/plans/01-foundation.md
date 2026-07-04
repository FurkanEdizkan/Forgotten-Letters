# Sprint 1 — Foundation

> Goal: a working Next.js app on Vercel with auth, the grimdark theme wired
> into shadcn, and CI/branch-protection so all later work flows through PRs.
>
> Phases included: **1, G1, G2, G4**.

---

## Phase 1 — Bootstrap, Auth, Layout

### 1.1 Initialize Next.js

- [ ] In container, in `/workspace`: `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [ ] Confirm `npm run dev` boots on port 3000
- [ ] Strip boilerplate from `src/app/page.tsx` and `src/app/layout.tsx`
- [ ] Commit: `chore: bootstrap next.js app`

### 1.2 shadcn/ui + grimdark theme

- [ ] `npx shadcn@latest init` — dark theme, zinc palette
- [ ] Add base components: `button input label card form toast separator avatar dropdown-menu sheet tabs skeleton dialog tooltip`
- [ ] Create `src/app/globals.css` with the `@theme` block from the palette table below (Charcoal / Ash / Bone White / Blood Red / Tarnished Gold)

  | Role               | Token                  | Hex       |
  | ------------------ | ---------------------- | --------- |
  | Background         | --color-bg             | `#0C0C0E` |
  | Surface            | --color-surface        | `#1A1A1F` |
  | Surface elevated   | --color-surface-elevated | `#252529` |
  | Border             | --color-border         | `#2E2E35` |
  | Text primary       | --color-text           | `#E8E2D6` |
  | Text secondary     | --color-text-secondary | `#9B9484` |
  | Text muted         | --color-text-muted     | `#5C574E` |
  | Accent primary     | --color-accent         | `#8B1A1A` |
  | Accent hover       | --color-accent-hover   | `#A52222` |
  | Accent secondary   | --color-gold           | `#B8923F` |
  | Accent gold muted  | --color-gold-muted     | `#8A6D2F` |
  | Success            | --color-success        | `#2D6B4F` |
  | Warning            | --color-warning        | `#B8860B` |
  | Error              | --color-error          | `#C0392B` |
  | Info               | --color-info           | `#4A6FA5` |
- [ ] **Map palette to shadcn tokens** in `globals.css`:
  - `--primary` ← Blood Red `#8B1A1A`
  - `--primary-foreground` ← Bone White `#E8E2D6`
  - `--background` ← Charcoal `#0C0C0E`
  - `--card` / `--popover` ← Ash Gray `#1A1A1F`
  - `--border` / `--input` ← Trench Gray `#2E2E35`
  - `--ring` ← Blood Red
  - `--destructive` ← Flare Red `#C0392B`
  - `--muted-foreground` ← Dust `#9B9484`
- [ ] Add Cinzel + Inter via `next/font/google`; expose as `--font-display` and `--font-sans`
- [ ] Verify a sample Button + Card renders in grimdark

### 1.3 Supabase project

- [ ] Create Supabase project (org: Forgotten-Letters)
- [ ] Copy URL + anon key into `.env.local`; add `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `npm install @supabase/supabase-js @supabase/ssr`
- [ ] `supabase link --project-ref <ref>`

### 1.4 Auth providers

- [ ] Enable Email/Password in dashboard
- [ ] Enable Google OAuth (create Google Cloud OAuth client first)
- [ ] Add localhost + production redirect URLs

### 1.5 Supabase clients

- [ ] `src/lib/supabase/client.ts` — `createBrowserClient`
- [ ] `src/lib/supabase/server.ts` — `createServerClient` with cookies
- [ ] `src/lib/supabase/middleware.ts` — refresh session helper
- [ ] `src/middleware.ts` — protect `/settings/*`, `/scenarios/*/edit`, `/scenarios/new`, `/campaigns/*/edit`, `/campaigns/new`, `/warbands/*` (except `/warbands/[id]/view`), `/admin/*`

### 1.6 Auth pages

- [ ] `src/app/(auth)/login/page.tsx`
- [ ] `src/app/(auth)/register/page.tsx` (TOS-acceptance checkbox; link is a placeholder, real page lands in S2)
- [ ] `src/app/(auth)/forgot-password/page.tsx`
- [ ] `src/app/(auth)/auth/callback/route.ts`
- [ ] `src/app/(auth)/auth/confirm/route.ts`
- [ ] `src/lib/validations/auth.ts` — Zod schemas

### 1.7 Layout shell

- [ ] `src/components/layout/Navbar.tsx` — logo (Cinzel), nav, auth dropdown (login/register or avatar), Reports/Admin slot stubbed
- [ ] `src/components/layout/Footer.tsx` — links (Terms, Privacy, DMCA placeholders)
- [ ] `src/app/layout.tsx` — Navbar + Footer + Toaster + skip-to-content link
- [ ] `src/app/(public)/page.tsx` — landing/hero (placeholder featured slot)

### 1.8 Vercel

- [ ] Connect GitHub repo
- [ ] Set env vars (preview + production)
- [ ] Confirm production build deploys
- [ ] Add `vercel.json` with `ignoreCommand` skipping docs-only changes:
  ```bash
  git diff --quiet HEAD^ HEAD -- . ':!docs' ':!README.md' ':!*.md'
  ```

### 1.9 Verify Phase 1

- [ ] Register → email confirm → login works
- [ ] Google OAuth works
- [ ] Forgot-password flow sends reset email (Supabase default templates for now; customised in N1)
- [ ] Navbar reflects auth state
- [ ] Protected routes redirect to `/login`
- [ ] Logout clears session
- [ ] Production deploy reachable, theme renders correctly

---

## Phase G1 — Testing infrastructure (parallel with 1.5+)

- [ ] `npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8`
- [ ] `npm i -D @playwright/test`
- [ ] `vitest.config.ts` with 70% coverage thresholds (statements/branches/functions/lines) and excludes for `node_modules/`, `src/app/**/layout.tsx`, `src/app/**/loading.tsx`, `src/types/**`, `**/*.d.ts`, `supabase/**`, `sanity/**`, `playwright/**`, `*.config.*`
- [ ] `playwright.config.ts`
- [ ] Scripts in `package.json`: `test`, `test:watch`, `test:coverage`, `test:e2e`, `test:e2e:ui`, `lint`, `lint:fix`, `typecheck`, `format`, `format:check`
- [ ] `tests/utils/setup.ts` — render helpers + provider mocks
- [ ] `tests/utils/supabase-mock.ts` — Supabase client factory
- [ ] One sample passing unit test (`src/lib/validations/auth.test.ts`)

## Phase G2 — Git hooks & commit enforcement (parallel)

- [ ] `npm i -D husky lint-staged @commitlint/cli @commitlint/config-conventional`
- [ ] `npx husky init`
- [ ] `commitlint.config.cjs` extending `@commitlint/config-conventional` with project scopes: `auth`, `warband`, `scenario`, `campaign`, `map-editor`, `cms`, `admin`, `ui`, `db`, `api`, `deps`
- [ ] `.husky/pre-commit` → `npx lint-staged`
- [ ] `.husky/commit-msg` → `npx commitlint --edit "$1"`
- [ ] `lint-staged` block in `package.json` (eslint --fix + prettier)

## Phase G4 — Branch protection (parallel)

- [ ] Create `develop` branch
- [ ] Protect `main`: require PR + 1 approval, status checks (`lint`, `typecheck`, `test`, `build`), linear history, no force push, no deletion
- [ ] Protect `develop`: require PR + 1 approval, status checks, no deletion
- [ ] Auto-delete merged feature branches
- [ ] Default merge: squash for `develop`, rebase for `main`

---

## Sprint 1 — Verify

- [ ] CI runs on a PR to `develop` and all checks pass
- [ ] Conventional commit enforcement blocks a bad commit locally
- [ ] Pushed branch produces a Vercel preview URL (password-protected)
- [ ] Auth round-trip works on the preview deploy
- [ ] Theme tokens applied: a shadcn Button shows Blood Red, body text is Bone White on Charcoal
