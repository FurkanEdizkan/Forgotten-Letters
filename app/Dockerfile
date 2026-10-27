# syntax=docker/dockerfile:1

# Production dependencies only (no install scripts needed).
FROM node:26-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# The build: every asset (fonts, styles, scripts) is bundled into build/, nothing is fetched at run time.
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM node:26-slim
# PostgreSQL 18 client tools (pg_dump, pg_restore) from the PGDG repository, for backups; tini as the init process.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates postgresql-common tini \
	&& /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
	&& apt-get install -y --no-install-recommends postgresql-client-18 \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG APP_VERSION=dev
# PORT_LOCKED: Compose publishes the port (APP_PORT in .env), so the app shows it but never moves it.
ENV NODE_ENV=production \
	PORT=3000 \
	PORT_LOCKED=1 \
	APP_VERSION=$APP_VERSION \
	MIGRATIONS_DIR=/app/drizzle \
	BACKUP_DIR=/data/backups \
	BODY_SIZE_LIMIT=1M \
	SHUTDOWN_TIMEOUT=20
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/build ./build
COPY --from=build /app/server ./server
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
# New named volumes take this ownership on first mount.
RUN mkdir -p /data/backups /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# -s: still reaps zombies when compose's `init: true` (docker-init) is PID 1.
ENTRYPOINT ["tini", "-s", "--"]
# The custom server (server/index.js) around the built app; see that file for why.
CMD ["node", "server"]
