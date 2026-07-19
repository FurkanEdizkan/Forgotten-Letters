# Forgotten Letters

Community-driven scenario repository for wargame scenario generation and sharing —
starting with **Trench Crusade**, designed to expand to other game systems.

**Free, open source, and self-hostable.** Costs are kept low so the project can run on
modest infrastructure; it sustains itself through unobtrusive ads and optional supporter
tiers, never paywalls on community content.

> **Status:** pre-bootstrap. The repo currently holds planning + design documentation.
> The application has not been scaffolded yet — see [`TODO.md`](TODO.md) for the build
> roadmap and [`docs/`](docs/) for architecture, deployment, cost, and monetization plans.

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

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | **Auth.js (NextAuth v5)** — Credentials + Google + GitHub |
| Database | **PostgreSQL + Drizzle ORM** |
| Object storage | **Cloudflare R2** (S3-compatible, zero egress fees) |
| Official content | **MDX-in-repo** (rules / legal / FAQ); Payload CMS optional later |
| Rich text | Tiptap |
| Map editor | react-konva (Konva.js) |
| Email | **Amazon SES** |
| Payments | **Stripe** (supporter tiers) + GitHub Sponsors / Ko-fi (donations) |
| Ads | **EthicalAds / Carbon** (primary) + Google AdSense (consent-gated fallback) |
| Hosting | **AWS Lightsail Containers / Fargate** + Docker, fronted by **Cloudflare** |
| Repo / CI | GitHub + GitHub Actions |

This stack is a deliberate move away from the original managed plan (Vercel + Supabase +
Sanity) toward a fully open-source, self-hostable stack. See
[`docs/Architecture.md`](docs/Architecture.md) for the rationale and
[`docs/Costs.md`](docs/Costs.md) for the cost comparison.

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/BuildPlan.md`](docs/BuildPlan.md) | Local-first execution plan: devcontainer + docker, per-phase test/security gates, then hosting |
| [`docs/Architecture.md`](docs/Architecture.md) | System design, data layer, auth, storage, AI Forge, old→new mapping |
| [`docs/Deployment.md`](docs/Deployment.md) | AWS Lightsail/Fargate + Docker + Cloudflare + SES + CI/CD |
| [`docs/Costs.md`](docs/Costs.md) | Managed vs self-hosted cost tables + break-even math |
| [`docs/Monetization.md`](docs/Monetization.md) | Ads + supporter tiers mapped to the Pricing design |
| [`docs/DesignSystem.md`](docs/DesignSystem.md) | The `FL` 16-color palette, ratios, fonts → Tailwind/CSS |
| [`docs/UI-Surfaces.md`](docs/UI-Surfaces.md) | The 18 designed surfaces → routes → build priority |
| [`docs/ClaudeDesign-Prompt.md`](docs/ClaudeDesign-Prompt.md) | Paste-ready prompt to redesign/extend the UI |

## Getting started

> The app is not bootstrapped yet. The full local stack (Postgres + MinIO + Mailpit via the
> compose-based devcontainer) is specified in [`docs/BuildPlan.md`](docs/BuildPlan.md).
> Once Phase 1 of [`TODO.md`](TODO.md) lands, the basic flow will be:

```bash
cp .env.example .env.local        # fill in real values (see docs/Deployment.md)
docker compose up -d db           # local Postgres
npm install
npm run db:migrate                # apply Drizzle migrations
npm run dev                       # http://localhost:3000
```

### Prerequisites

- Node.js 22+, npm
- Docker + Docker Compose (local Postgres, container builds)

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

| Port | Service |
|---|---|
| 3000 | Next.js dev server |
| 5432 | PostgreSQL (local, via Docker) |

## Contributing

This is a fan-made community archive, not affiliated with any game publisher. Trench
Crusade and other game systems remain the property of their respective publishers; we
host community-authored content only. Contribution guidelines will land with the app
bootstrap.

## License

To be finalized as an OSI-approved open-source license (AGPL-3.0 or MIT under
consideration) before the first code release.
