# Tech Stack

## Frontend & SSR
- **Next.js 15** (App Router) — React framework with SSR/SSG, deployed on Vercel
- **TypeScript** — type-safe language across the entire codebase
- **Tailwind CSS v4** — utility-first CSS framework
- **shadcn/ui** — headless component library built on Radix UI

## Backend Services
- **Supabase** — Auth (Email/Password + Google OAuth), Postgres database, Storage (file uploads)
- **Sanity** — Headless CMS for official/editorial content (rules, official scenarios, news)

## Map Editor
- **react-konva** (Konva.js) — canvas-based 2D map editor with shapes, images, layers

## Hosting & Deployment
- **Vercel** — frontend hosting, serverless functions, edge middleware, cron jobs
- **Supabase Cloud** — managed Postgres, Auth, Storage
- **GitHub** — source control, CI/CD trigger for Vercel deploys

## Dev Tools
- **ESLint** + **Prettier** — linting and formatting
- **Zod** — runtime schema validation
- **Tiptap** — rich text editor for scenario stories (planned)
- **Supabase CLI** — local development, migrations, type generation
- **Sanity CLI** — studio development and deployment
- **Vercel CLI** — preview deploys and env management