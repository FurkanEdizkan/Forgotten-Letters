# Build Plan — Forgotten Letters (local-first, then hosting)

> The execution plan for building the app. Strategy: stand up a **complete local
> development environment** (devcontainer + docker containers with local stand-ins for every
> cloud service) and build/test/secure everything locally **before** hosting on AWS.
> Companion to the feature roadmap in [TODO.md](../TODO.md) and the specs in [docs/](.).

## Context

The repo has full design/architecture docs ([docs/](.)) and a feature roadmap
([TODO.md](../TODO.md)), but **no app exists yet** — `src/` is empty `.gitkeep` placeholders,
there is no `package.json`, and the `docker-compose.yml` referenced in
[Deployment.md](./Deployment.md) is only a snippet. The current devcontainer is
single-container and brings up only the dev box, not the backing services.

Goal: a complete local dev environment where every framework/implementation can be **built,
run, tested, and security-checked locally** before any hosting. Hosting (AWS) comes last.

**Decisions locked in:**
- **Full local cloud parity** — Postgres + **MinIO** (S3-compatible R2 stand-in) + **Mailpit**
  (SMTP/email catcher) in compose; **Stripe CLI** test mode; **mock AI provider**. The same
  `@aws-sdk/client-s3` + SMTP code runs locally and in prod — only env differs.
- **Compose-based devcontainer** — opening the project auto-starts dev box + db + minio + mailpit.
- **Vitest + Playwright** — Vitest for unit/integration, Playwright for e2e; plus a security gate.

[TODO.md](../TODO.md) remains the canonical feature roadmap (Phases 1–10). This plan **inserts
a real Phase 0 (local foundation)** and attaches a **per-phase Test gate + Security gate** to
each feature phase.

---

## Part A — "Required parts for starting development" (Phase 0)

Concrete artifacts to create first. After this phase, `docker compose up` + `npm run dev`
yields a running app wired to local Postgres/MinIO/Mailpit, with tests, lint, typecheck, and
CI all green on an otherwise-empty app.

### A1. Local services + devcontainer (full parity)
- **`.devcontainer/docker-compose.yml`** — services:
  - `app` — built from `.devcontainer/Dockerfile`, mounts the workspace, runs as `developer`.
  - `db` — `postgres:16-alpine` (`forgotten`/`forgotten`/`forgotten_letters`), volume `pgdata`, `:5432`.
  - `minio` — `minio/minio` (`:9000` API, `:9001` console), volume `miniodata`.
  - `minio-init` — one-shot `minio/mc` job creating buckets `forgotten-letters-assets` +
    `forgotten-letters-avatars`, setting public-read on the assets bucket.
  - `mailpit` — `axllent/mailpit` (`:1025` SMTP, `:8025` web UI).
- **Rewrite `.devcontainer/devcontainer.json`** → `dockerComposeFile`, `service: app`,
  `runServices: [db, minio, minio-init, mailpit]`, `forwardPorts: [3000,5432,9000,9001,8025]`,
  `postCreateCommand: npm install`; keep the current VS Code extensions/settings.
- **Root `docker-compose.yml`** — prod-shaped single box (`app` from root `Dockerfile` + `db`)
  per [Deployment.md §2](./Deployment.md); used to test the real production image locally and
  reused on Lightsail in Phase 10.
- **Root `Dockerfile`** — standalone multi-stage build (reference in
  [Deployment.md §1](./Deployment.md)); lets us validate the prod image builds early.

### A2. Next.js app bootstrap
- `create-next-app` (TS, Tailwind, ESLint, App Router, `src/`, alias `@/*`) → `package.json`,
  `next.config.ts` (set `output: 'standalone'`), `tsconfig.json`, base `src/app/`.
- Strip boilerplate; add the **FL design tokens** to `globals.css` from
  [DesignSystem.md](./DesignSystem.md) (CSS vars + Tailwind v4 `@theme`); fonts + `.fl-grain`.
  `npx shadcn init` (dark, zinc) re-themed to FL tokens.

### A3. Typed config + cloud clients (parity layer)
- **`src/lib/env.ts`** — Zod-validated env (fail fast at boot; no missing secrets). Add
  `R2_ENDPOINT` + `R2_FORCE_PATH_STYLE` to **`.env.example`** so the S3 client targets MinIO
  locally and R2 in prod with identical code.
- **`src/lib/db/`** — `client.ts` (drizzle + `pg`), `schema.ts` (start minimal),
  `drizzle.config.ts`; scripts `db:generate` / `db:migrate` / `db:push` / `db:studio`;
  migrations output to **`db/migrations/`** (per [Architecture.md](./Architecture.md)).
- **`src/lib/storage/r2.ts`** — S3 client honoring `R2_ENDPOINT`/path-style; presigned PUT/GET
  helpers. Works against MinIO locally, R2 in prod.
- **`src/lib/mail/`** — nodemailer SMTP transport (Mailpit `:1025` locally, SES in prod).
- **`.env.local`** — created by the dev from `.env.example` (gitignored) with local values
  (local `DATABASE_URL`, MinIO endpoint/keys, Mailpit host). Document the steps in README.

### A4. Quality + security tooling (the gates)
- **Vitest** config + a sample unit test; `npm test`.
- **Playwright** config + an `e2e/` smoke test (home page renders); `npm run test:e2e`.
- **ESLint + Prettier** configs; `npm run lint`, `npm run typecheck`.
- **Husky + lint-staged** pre-commit: format + lint + typecheck on staged files.
- **`/api/health`** route — DB ping + R2 reachability (also the container healthcheck later).
- **`.github/workflows/ci.yml`** — install → lint → typecheck → unit tests → `next build` →
  `npm audit --audit-level=high` → **gitleaks** secret scan. (Deploy job added in Phase 10.)
- **`.github/dependabot.yml`** (npm + GitHub Actions) and a `.gitleaks.toml`.

### Phase 0 verification (must all pass before Phase 1)
`docker compose up -d` brings up db+minio+mailpit; `npm run dev` serves `:3000`; `/api/health`
returns OK (DB + MinIO reachable); a trivial Drizzle migration applies; `npm test`,
`npm run test:e2e`, `npm run lint`, `npm run typecheck`, and `docker build .` (prod image) all
succeed; CI is green.

---

## Part B — Cross-cutting strategies (apply to every phase)

### Testing strategy
- **Unit/integration (Vitest):** Zod schemas, server actions, authz guards, storage/quota
  helpers, entitlement computation. Integration tests run against the **compose Postgres**
  (real DB, migrations applied) and **MinIO** — not mocks — so framework behavior is real.
- **E2E (Playwright):** the critical journeys per phase (register→verify(Mailpit)→login,
  create/publish scenario, upload to MinIO, Stripe test checkout→entitlement).
- **Gate:** a phase ends only when its unit + e2e tests and lint/typecheck pass locally and in CI.

### Security strategy (the "secure" requirement, enforced per phase)
- **Env validation** (`src/lib/env.ts`) — boot fails on missing/invalid secrets.
- **App-layer authorization** (`src/lib/auth/guards.ts`) replaces Supabase RLS — explicit
  ownership/role checks in **every** mutating server action, with unit tests proving
  cross-user denial.
- **Input validation** — Zod on every server action / route input.
- **Rate limiting** — `rate-limiter-flexible` (Postgres store) on auth, upload, comment, vote.
- **Upload safety** — server-side MIME sniff + size cap + quota check; presigned URLs with
  short TTL and content constraints; buckets never public-write.
- **Content sanitization** — sanitize Tiptap/markdown/HTML (rehype-sanitize / sanitize-html).
- **Security headers** — CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors
  via `next.config`/middleware.
- **Secret hygiene** — `.env*` gitignored, gitleaks in CI, secrets only via env/GH secrets,
  never baked into the image.
- **Dependency hygiene** — `npm audit` + Dependabot.
- **Pre-launch:** run a full security review on the branch and an OWASP pass (Phase 10).

---

## Part C — Per-phase plan (feature build, local-first)

Each phase = the [TODO.md](../TODO.md) work **plus** a Test gate and Security gate. Phases ship
and are verified entirely on the local compose stack; nothing requires the cloud until Phase 10.

- **Phase 1 — Bootstrap, theme & auth.** Next.js shell + FL theme + **Auth.js v5** (Credentials
  + Google + GitHub, Drizzle adapter, DB sessions), auth pages, SES/Mailpit email,
  middleware-protected routes, layout shell.
  *Test:* register→verify(via Mailpit)→login; OAuth; protected-route redirects.
  *Security:* DB-session cookies, Auth.js CSRF, Zod auth schemas, rate-limit login/register.
- **Phase 2 — Schema & storage.** Full Drizzle schema (core + monetization tables, enums,
  indexes), DB logic (storage-quota, vote-count, storage-counter), **R2/MinIO** upload action,
  authz guards.
  *Test:* unpublished-row isolation across users; over-quota upload rejected; counter updates.
  *Security:* guards enforced + tested; MIME/size/quota on upload; presigned-URL TTL.
- **Phase 3 — Official content (MDX).** `src/content/` rules/legal/faq/official with version
  selector. *Test:* version switching renders right edition. *Security:* MDX sanitized.
- **Phase 4 — Campaign & scenario CRUD.** Zod schemas, guarded server actions, campaign graph
  editor, scenario editor (Tiptap), deep-copy duplicate.
  *Test:* CRUD/duplicate/cascade, author-only edit. *Security:* authz on every action; sanitize story HTML.
- **Phase 5 — 2D map editor (react-konva).** Editor, shape library, image import (MinIO
  presigned, quota), save/load map JSON, PNG export, 24h temp-file cleanup task.
  *Test:* persistence, undo/redo, export, quota rejection, temp cleanup.
  *Security:* upload validation, temp-file scoping.
- **Phase 6 — Warbands.** Builder, browser/leaderboard, public detail, guarded actions +
  campaign submit/approval. *Test:* build/save/leaderboard/favorite/copy/approval.
- **Phase 7 — Social, profiles & play loop.** Votes/favorites/threaded comments, profiles,
  browse/search, battle tracker + post-battle report, notifications, news.
  *Test:* social persistence, browse results. *Security:* sanitize comments, rate-limit.
- **Phase 8 — Account, settings & AI Forge.** Settings (2FA, delete-account), storage dashboard,
  **AI Forge** (server-only provider via **mock locally**, `forge_jobs` + credit debit).
  *Test:* settings round-trip, avatar upload frees quota, Forge debits + stores in MinIO.
  *Security:* provider keys server-only, credit gate prevents runaway spend.
- **Phase 9 — Monetization & ads.** AdSlot/consent/upsell/badge, EthicalAds + AdSense
  (consent-gated), **Stripe** (Checkout, `/api/webhooks/stripe` via **Stripe CLI** locally,
  entitlement sync), feature gates.
  *Test:* supporter sees no ads; checkout→webhook→entitlement; quota boundary→upsell;
  cancel→downgrade. *Security:* verify Stripe webhook signature; gates enforced server-side.

---

## Part D — Phase 10: hosting (deferred, only after local is solid & secure)

Per [Deployment.md](./Deployment.md): Lightsail Containers (Postgres co-located or RDS micro),
Cloudflare DNS/TLS/CDN + R2 custom domain, **SES** domain verification + production access,
GitHub Actions **deploy** job (build→migrate→deploy), nightly `pg_dump`→R2, rate limiting +
sanitization final pass, **full security review + OWASP pass**, SEO, error tracking.
*Verify:* prod deploy stable; Lighthouse Perf>80/A11y>90/SEO>90; ~$10–20/mo cost floor
([Costs.md](./Costs.md)); restore-from-backup tested.

---

## Critical files this plan creates/changes (representative)
- Infra: `.devcontainer/docker-compose.yml`, `.devcontainer/devcontainer.json` (rewrite), root
  `docker-compose.yml`, root `Dockerfile`, `.env.example` (add `R2_ENDPOINT` etc.).
- App config: `package.json`, `next.config.ts`, `tsconfig.json`, `drizzle.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, ESLint/Prettier configs.
- Parity/libs: `src/lib/env.ts`, `src/lib/db/{client,schema}.ts`, `src/lib/storage/r2.ts`,
  `src/lib/mail/*`, `src/app/api/health/route.ts`.
- CI/security: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitleaks.toml`,
  Husky/lint-staged config.

## Overall verification
Local: `docker compose up` + `npm run dev` → working app on the local stack; full test suite +
lint + typecheck + prod `docker build` green; `/api/health` OK. Each feature phase verified on
the compose stack via its Test + Security gates before moving on. Hosting (Phase 10) only after
the local app is feature-complete and the security pass is clean.

## Suggested first execution step
Implement **Phase 0** (Part A) as one branch/PR (`chore: local dev foundation`) so the
environment is reviewable and green before any feature work begins.
