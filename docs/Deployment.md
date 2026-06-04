# Deployment

How to run Forgotten Letters in production on AWS, and how anyone can self-host their own
instance. The whole stack is one Docker image plus Postgres, fronted by Cloudflare, with
assets on R2 and email via SES.

> Status: this is the target deployment design. The app is not bootstrapped yet, so the
> Dockerfile / compose snippets below are reference templates for the implementation PR.

## Topology

```
Cloudflare (DNS, TLS, CDN, R2)
        │
        ▼
AWS Lightsail Container (or Fargate)  ── runs the Next.js Docker image
        │
        ├── PostgreSQL  (sibling container on the same host, or RDS micro)
        ├── Cloudflare R2  (assets + avatars, zero-egress)
        └── Amazon SES  (transactional email)
```

## 1. Container image

Standalone Next.js output keeps the image small. Reference `Dockerfile`:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build           # next build, output: 'standalone'

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Set `output: 'standalone'` in `next.config.ts`.

## 2. Local & single-box stack (`docker-compose.yml`)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: forgotten
      POSTGRES_PASSWORD: forgotten
      POSTGRES_DB: forgotten_letters
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]
  app:
    build: .
    env_file: .env.local
    depends_on: [db]
    ports: ["3000:3000"]
volumes: { pgdata: {} }
```

For a cheap production single box, this same compose file (app + db) runs on one Lightsail
instance. Postgres data lives on a persistent volume; back it up (see §7).

## 3. Hosting choice — Lightsail vs Fargate

| | **Lightsail Containers** (recommended start) | **AWS Fargate** |
|---|---|---|
| Pricing | Flat $7–$20/mo per node | Per vCPU/sec — scales with use |
| Ops | Simplest; push image, done | More moving parts (ECS, ALB, task defs) |
| Scaling | Manual / fixed | Auto-scaling, load-balanced |
| Best for | Launch + low traffic | When metrics justify horizontal scale |

Start on **Lightsail Containers**. Migrate to Fargate only when traffic/availability needs
it — the Docker image and env vars are identical, so the move is low-friction.

## 4. Cloudflare + R2

1. Point the domain's DNS at Cloudflare (proxied), get free TLS + edge caching.
2. Create two R2 buckets: `forgotten-letters-assets`, `forgotten-letters-avatars`.
3. Add a Cloudflare custom domain in front of the assets bucket → set as
   `NEXT_PUBLIC_ASSET_BASE_URL` so reads are cached and **egress is free**.
4. Create an R2 API token (Account ID + access key/secret) for presigned uploads.
5. Cache rules: cache `*/assets/*` and static routes aggressively; bypass cache for
   `/api/*` and authenticated pages.

## 5. Email (Amazon SES)

1. Verify the sending domain in SES; add the DKIM/SPF records to Cloudflare DNS.
2. Request production access (move out of the SES sandbox).
3. Create SMTP credentials (or an IAM user scoped to `ses:SendEmail`); fill the `SES_*`
   and `EMAIL_FROM` env vars. Auth.js uses these for verification + password-reset mail.

## 6. CI/CD (GitHub Actions)

Pipeline outline (`.github/workflows/deploy.yml`):

```
on: push to main
jobs:
  build-and-deploy:
    - checkout
    - npm ci && npm run lint && npm run typecheck && npm test
    - docker build -t $IMAGE:$SHA .
    - push image to registry (ECR or GHCR)
    - run db migrations:  npm run db:migrate   (against prod DATABASE_URL)
    - deploy:  aws lightsail push-container-image + create-container-service-deployment
               (or: update ECS service for Fargate)
```

Store all secrets in GitHub Actions secrets; never bake them into the image. Run
migrations as a discrete step before the new image takes traffic.

## 7. Data durability

- **Postgres:** nightly `pg_dump` to R2 (or RDS automated backups if using RDS). Test
  restore quarterly. If co-locating Postgres on Lightsail, snapshot the instance disk too.
- **R2:** enable object versioning on the assets bucket; lifecycle-expire old temp files.
- **Temp-file sweep:** the 24h cleanup task (cron container / EventBridge schedule) removes
  abandoned `is_temporary` uploads from both Postgres and R2 and reconciles the storage
  counter.

## 8. Environment variables

All required variables are documented in [`.env.example`](../.env.example). Production
values are injected via the Lightsail/Fargate service config or GitHub Actions secrets —
not committed. Key groups: Core, Database, Auth.js, R2, SES, Stripe, donations, Ads, AI
Forge, rate limiting.

## 9. Health & observability (low-cost)

- Add a `/api/health` route (DB ping + R2 reachability) for the container health check.
- Cloudflare Web Analytics (free) for traffic; container logs to CloudWatch (cheap) or
  stdout + a log drain.
- Optional: a free-tier error tracker (e.g. self-hostable GlitchTip / Sentry free) wired
  in later — kept out of the critical path to preserve the cost floor.
