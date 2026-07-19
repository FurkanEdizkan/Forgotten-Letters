# Tech Stack

> Self-hostable, open-source stack targeting a ~$10–20/mo cost floor with no vendor
> lock-in. See [Architecture.md](./Architecture.md), [Deployment.md](./Deployment.md),
> and [Costs.md](./Costs.md) for the full picture.

## Frontend & SSR
- **Next.js 15** (App Router) — React framework with SSR/SSG, shipped as a Docker image
- **TypeScript** — type-safe language across the entire codebase
- **Tailwind CSS v4** — utility-first CSS framework
- **shadcn/ui** — headless component library built on Radix UI

## Backend & Data
- **PostgreSQL** — primary database (sibling container on the same box, or RDS micro)
- **Drizzle ORM** — schema, queries, and SQL migrations under `db/migrations/`; types
  inferred via `$inferSelect` / `$inferInsert` (no separate type-generation step)
- **Auth.js v5 (NextAuth)** — Credentials + Google + GitHub providers, Drizzle adapter;
  authorization enforced app-side in server actions (replaces Supabase RLS)
- **Cloudflare R2** — object storage for uploads (maps, avatars, AI art, STL) via the
  S3 SDK + presigned URLs; **zero egress fees**, per-user quota enforced in app
- **MDX-in-repo** (`src/content/`) — official/editorial content (rules, legal, FAQ);
  version-controlled and reviewed via PRs (Payload CMS optional for news later)
- **Amazon SES** — transactional email (verification, password reset)
- **rate-limiter-flexible** — rate limiting backed by the Postgres store

## Map Editor
- **react-konva** (Konva.js) — canvas-based 2D map editor with shapes, images, layers

## Hosting & Deployment
- **AWS Lightsail Containers** — flat-rate container hosting (migrate to Fargate when
  traffic/availability needs it)
- **Cloudflare** — DNS, free TLS, CDN edge caching, and R2 in front of the app
- **Docker / docker-compose** — single-box stack (app + `postgres:16` on port 5432)
- **GitHub** — source control and CI/CD

## Monetization
- **Stripe** — supporter tier billing; webhooks sync `subscriptions` + `entitlements`
- **EthicalAds / Carbon** (primary, no-tracking) + **Google AdSense** (consent-gated fallback)
- **GitHub Sponsors / Ko-fi** — optional donations (supporter badge)

## Dev Tools
- **ESLint** + **Prettier** — linting and formatting
- **Zod** — runtime schema validation
- **Tiptap** — rich text editor for scenario stories (planned)
- **Drizzle Kit** — migrations and schema management (run via `npx`, a project dependency)
- **PostgreSQL client** (`psql`) — local database access
