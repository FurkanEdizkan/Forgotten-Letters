# Forgotten Letters

Community-driven scenario repository for wargame scenario generation and sharing — starting with **Trench Crusade**, designed to expand to other game systems.

## Features (Planned)

- 2D scenario map editor (canvas-based with predefined shapes and image import)
- Campaign & scenario creation with rich text, event tables, victory conditions
- Duplicate and edit scenarios
- Official scenarios & rules section (CMS-managed)
- User accounts with profile, storage quotas, and settings
- Comments, favorites, upvotes, sharing
- Browse & search with filters (game system, player count, tags)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth / DB / Storage | Supabase (Auth, Postgres, Storage) |
| CMS (official content) | Sanity |
| Map Editor | react-konva (Konva.js) |
| Hosting | Vercel |
| Repo | GitHub |

## Getting Started

### Prerequisites

- Docker + Docker Compose (for dev container)
- VS Code with Dev Containers extension (recommended)
- Or: Node.js 22+, npm

### Dev Container (recommended)

1. Open this repo in VS Code
2. `Ctrl+Shift+P` → **Dev Containers: Reopen in Container**
3. The container installs Node 22, TypeScript, Supabase CLI, Sanity CLI, and Vercel CLI
4. Copy `.env.example` → `.env.local` and fill in your keys
5. `npm install && npm run dev`

### Local (without container)

```bash
cp .env.example .env.local   # fill in real values
npm install
npm run dev                   # http://localhost:3000
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, register, forgot-password
│   ├── (public)/        # Browse, view scenarios, user profiles
│   ├── (protected)/     # Create/edit scenarios, settings
│   └── api/             # API routes, cron jobs
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── layout/          # Navbar, footer, sidebar
│   ├── map-editor/      # Konva-based 2D map editor
│   ├── scenario-form/   # Scenario creation/edit forms
│   └── social/          # Vote, comment, favorite, share
├── lib/
│   ├── supabase/        # Supabase client, server, middleware, types
│   ├── sanity/          # Sanity client, GROQ queries
│   ├── actions/         # Server actions (CRUD, uploads, social)
│   ├── validations/     # Zod schemas
│   └── utils/           # Shared helpers
└── types/               # Shared TypeScript types

sanity/                  # Sanity Studio schemas & config
supabase/
├── migrations/          # SQL migration files
└── seed/                # Seed data
public/                  # Static assets
docs/                    # Project documentation
```

## Environment Variables

See [.env.example](.env.example) for all required variables.

## Ports

| Port | Service |
|---|---|
| 3000 | Next.js dev server |
| 3333 | Sanity Studio |
| 54321 | Supabase API (local) |
| 54322 | Supabase Studio (local) |

## License

TBD