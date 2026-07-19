# ============================================================
# Forgotten Letters — production image
#
# Multi-stage build on Next.js standalone output (see
# docs/Deployment.md §1). Requires `output: 'standalone'` in
# next.config.ts — without it, .next/standalone is never emitted
# and the runner stage fails to find server.js.
#
# This is the PROD image, deployed to Lightsail/Fargate in Phase 10.
# For local development use .devcontainer/docker-compose.yml.
# ============================================================

# ── Stage 1: dependencies ───────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
# Copy only manifests so this layer caches until deps actually change.
COPY package*.json ./
RUN npm ci

# ── Stage 2: build ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user. node:22-alpine ships a `node` user (uid 1000).
USER node

# The standalone bundle carries its own minimal node_modules and
# server.js; static/ and public/ are not included and must be copied.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000

# Phase 0 (A4) adds /api/health; point the healthcheck at it then.
CMD ["node", "server.js"]
