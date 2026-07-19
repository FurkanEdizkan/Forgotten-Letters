# Forgotten Letters

Community-driven scenario repository for wargame scenario generation and sharing —
starting with **Trench Crusade**, designed to expand to other game systems.

**Free, open source, and self-hostable.** Costs are kept low so the project can run on
modest infrastructure; it sustains itself through unobtrusive ads and optional supporter
tiers, never paywalls on community content.

> **Status:** Phase 0 complete — local foundation is built and green. The full local
> stack (Postgres + MinIO + Mailpit) runs in Docker, the database/storage/mail layers
> are wired and health-checked, and CI enforces lint, typecheck, unit, e2e, audit, and
> secret-scan gates.
>
> The ~20 UI pages still render **static mock data** — replacing those with real queries
> is feature work that begins in Phase 1 (auth). See [`TODO.md`](TODO.md) for the roadmap
> and [`docs/BuildPlan.md`](docs/BuildPlan.md) for the execution plan.
>
> Alongside it, [`design-lab/`](design-lab/) is a standalone Vite sandbox used to prototype
> the grimdark visual language before changes are ported into the main app.

## Features (planned)

- 2D scenario map editor (canvas-based, predefined shapes + image import + shape export)
- Campaign & scenario creation with rich text, event tables, victory conditions, and a
  node-based **campaign graph** with branching/optional paths and per-scenario rewards
- Warband builder with faction rules, stat blocks, keywords, Battlekit, and leaderboards
- AI Forge — describe a swap (e.g. "an axe instead of a blade"), regenerate the model art
  and STL via pluggable AI providers
- Official scenarios & rules viewer with version selection (MDX-in-repo content)
- User accounts, public profiles, win/loss history, storage quotas, settings
- Comments, favorites, upvotes, sharing
- Browse & search with filters (game system, faction, player count, tags, rules version)

## Tech stack

| Layer            | Technology                                                                  |
| ---------------- | --------------------------------------------------------------------------- |
| Framework        | Next.js 15 (App Router)                                                     |
| Language         | TypeScript                                                                  |
| Styling          | Tailwind CSS v4 + shadcn/ui                                                 |
| Auth             | **Auth.js (NextAuth v5)** — Credentials + Google + GitHub                   |
| Database         | **PostgreSQL + Drizzle ORM**                                                |
| Object storage   | **Cloudflare R2** (S3-compatible, zero egress fees)                         |
| Official content | **MDX-in-repo** (rules / legal / FAQ); Payload CMS optional later           |
| Rich text        | Tiptap                                                                      |
| Map editor       | react-konva (Konva.js)                                                      |
| Email            | **Amazon SES**                                                              |
| Payments         | **Stripe** (supporter tiers) + GitHub Sponsors / Ko-fi (donations)          |
| Ads              | **EthicalAds / Carbon** (primary) + Google AdSense (consent-gated fallback) |
| Hosting          | **AWS Lightsail Containers / Fargate** + Docker, fronted by **Cloudflare**  |
| Repo / CI        | GitHub + GitHub Actions                                                     |

This stack is a deliberate move away from the original managed plan (Vercel + Supabase +
Sanity) toward a fully open-source, self-hostable stack. See
[`docs/Architecture.md`](docs/Architecture.md) for the rationale and
[`docs/Costs.md`](docs/Costs.md) for the cost comparison.

## Documentation

| Doc                                                          | What it covers                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| [`docs/HANDOFF.md`](docs/HANDOFF.md)                         | **Start here** — current state, next steps, blockers, and known traps                          |
| [`docs/BuildPlan.md`](docs/BuildPlan.md)                     | Local-first execution plan: devcontainer + docker, per-phase test/security gates, then hosting |
| [`docs/Architecture.md`](docs/Architecture.md)               | System design, data layer, auth, storage, AI Forge, old→new mapping                            |
| [`docs/Deployment.md`](docs/Deployment.md)                   | AWS Lightsail/Fargate + Docker + Cloudflare + SES + CI/CD                                      |
| [`docs/Costs.md`](docs/Costs.md)                             | Managed vs self-hosted cost tables + break-even math                                           |
| [`docs/Monetization.md`](docs/Monetization.md)               | Ads + supporter tiers mapped to the Pricing design                                             |
| [`docs/DesignSystem.md`](docs/DesignSystem.md)               | The `FL` 16-color palette, ratios, fonts → Tailwind/CSS                                        |
| [`docs/UI-Surfaces.md`](docs/UI-Surfaces.md)                 | The 18 designed surfaces → routes → build priority                                             |
| [`docs/ClaudeDesign-Prompt.md`](docs/ClaudeDesign-Prompt.md) | Paste-ready prompt to redesign/extend the UI                                                   |

## Getting started

The local stack runs every cloud service as a container, so nothing external is
needed to develop: **Postgres**, **MinIO** (stands in for Cloudflare R2), and
**Mailpit** (stands in for Amazon SES). `.env.example` ships working local
defaults — the copy below runs as-is.

```bash
cp .env.example .env.local                              # defaults target the local stack
docker compose -f .devcontainer/docker-compose.yml up -d db minio minio-init mailpit
npm install
npm run db:migrate                                      # apply Drizzle migrations
npm run dev                                             # http://localhost:3000
```

Then check <http://localhost:3000/api/health> — it reports `database`, `storage`,
and `mail` reachability, and is the fastest way to tell a broken app from a
container that failed to start.

In VS Code, **Dev Containers: Reopen in Container** starts all of the above
automatically.

| Service       | URL                                                    |
| ------------- | ------------------------------------------------------ |
| App           | <http://localhost:3000>                                |
| Health check  | <http://localhost:3000/api/health>                     |
| Mailpit inbox | <http://localhost:8025> — read verification email here |
| MinIO console | <http://localhost:9001> — `minioadmin`/`minioadmin`    |

### Prerequisites

- Node.js 22+, npm
- Docker + Docker Compose

### Common tasks

```bash
npm test              # unit tests (Vitest)
npm run test:e2e      # end-to-end smoke tests (Playwright)
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run format        # Prettier
npm run db:generate   # generate a migration after editing src/lib/db/schema.ts
npm run db:studio     # browse the database
docker compose up --build   # build and run the production image locally
```

## Project structure (planned)

```
src/
├── app/
│   ├── (auth)/          # Login, register, forgot/reset password, verify, 2FA
│   ├── (public)/        # Browse, view scenarios/campaigns/warbands, profiles, pricing/faq/legal
│   ├── (protected)/     # Create/edit, settings, billing
│   └── api/             # Route handlers, Stripe webhooks, cron jobs
├── components/
│   ├── ui/              # shadcn/ui primitives + FL-token theme
│   ├── layout/          # Navbar, Footer, QuickDrawer
│   ├── map-editor/      # Konva-based 2D map editor
│   ├── warband/         # Warband builder, roster, fighter detail
│   ├── campaign/        # Campaign graph editor, lobby, battle tracker
│   ├── monetization/    # Ad slots, cookie-consent banner, supporter/upsell UI
│   └── social/          # Vote, comment, favorite, share
├── lib/
│   ├── db/              # Drizzle schema, client, migrations
│   ├── auth/            # Auth.js config, adapters, session helpers
│   ├── storage/         # R2 / S3 client, presigned uploads, quota
│   ├── billing/         # Stripe client, entitlements, feature gates
│   ├── actions/         # Server actions (CRUD, uploads, social)
│   ├── validations/     # Zod schemas
│   └── utils/           # Shared helpers
└── content/             # MDX: rules, legal, FAQ, official scenarios

docs/                    # Project documentation (this PR)
db/migrations/           # SQL migration files (Drizzle)
public/                  # Static assets
```

## Ports

| Port | Service                        |
| ---- | ------------------------------ |
| 3000 | Next.js dev server             |
| 5432 | PostgreSQL (local, via Docker) |

## Contributing

This is a fan-made community archive, not affiliated with any game publisher. Trench
Crusade and other game systems remain the property of their respective publishers; we
host community-authored content only. Contribution guidelines will land with the app
bootstrap.

## License

To be finalized as an OSI-approved open-source license (AGPL-3.0 or MIT under
consideration) before the first code release.
