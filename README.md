# Forgotten Letters

A campaign tracker for Trench Crusade's *Carcass Front*, starting over on 2026-10-03: SvelteKit and PostgreSQL in
Docker Compose, rebuilt step by step.

## Install

You need Docker (Docker Desktop, or Docker Engine with the Compose plugin). Everything the app needs ships in the
image; it works with no internet connection.

1. Put `compose.yaml`, `Caddyfile` and `.env.example` in a folder and copy `.env.example` to `.env`.
2. In `.env`, set `POSTGRES_PASSWORD` (for example `openssl rand -base64 24`) and `ORIGIN`, the address people
   type: `http://<this machine's IP>:3000` on a LAN, `https://<DOMAIN>` with HTTPS.
3. Start it: `docker compose up -d`.
4. Open the one-time setup link (valid one hour) from the log and create the first owner:
   `docker compose logs app | grep setup`. Restart the app (`docker compose restart app`) for a new link.

**HTTPS** (a server on the internet): point your domain's DNS at the server, open ports 80 and 443, set
`DOMAIN=letters.example.org`, `ORIGIN=https://letters.example.org`, `ADDRESS_HEADER=X-Forwarded-For`,
`XFF_DEPTH=1` and `APP_PORT=127.0.0.1:3000` (so nobody reaches the app around Caddy) in `.env`, then `docker compose --profile https up -d` (or set `COMPOSE_PROFILES=https`). Caddy gets
the certificate.

**Backups.** The app writes a compressed `pg_dump` before every migration and once a day into the `backups` volume
(kept 14 days, `BACKUP_KEEP_DAYS`). Owners download and restore them in the owner area. To copy them out, or restore
by hand:

```sh
docker compose cp app:/data/backups ./backups                      # copy every dump to the host
docker compose exec app sh -c 'ls /data/backups'                   # list them
docker compose exec app sh -c 'PGPASSWORD=$POSTGRES_PASSWORD pg_restore --clean --if-exists --no-owner \
  --single-transaction -h db -U letters -d letters /data/backups/<file>.dump'
```

**Updates.** `docker compose pull && docker compose up -d`. The app backs up the database, applies migrations and
starts; `/health/ready` answers 200 once it is done.

**Locked out?** `docker compose exec app node scripts/owner-recovery.js <username>` gives that owner a temporary
password (changed at the next sign-in) and ends their sessions. Without a username it lists the owners, or prints a
new setup link when there is none.

**Development:** `docker compose -f compose.dev.yaml up -d` (database only), then `npm --prefix app run dev`. See
`AGENTS.md` for the other commands.

## Documents

| File | What it is |
|---|---|
| `PRODUCT.md` | Product requirements: users and roles, goals, roadmap, the current step's requirements |
| `DESIGN.md` | The design system: colour, type, layout, components |
| `ARCHITECTURE.md` | How it is built and why; the atlas model in `architecture/` is the detailed map |
| `AGENTS.md` | How AI agents (and people) work on it, step by step |

## What is kept

| Where | What |
|---|---|
| `assets/blender/` | The Blender scenes for the map effects and tokens, and the faction seals (`seals/`). |
| `assets/fx/` | The effect sprite sheets rendered from them (`.webp` + frame `.json`). |
| `assets/map/` | The campaign map extracted from the book (local only, never committed). |
| `docs/` | The books (`Trench Crusade/`, `Factions/`) and the rule packs read from them (`packs/`), local only; design specs in `superpowers/`. |
| `tools/atlas/` | The architecture atlas (LikeC4 model, map and checks). |
| `tools/blender-mcp/` | The Blender MCP bridge (see `.mcp.json`). |

## The first version

The whole first app (SvelteKit, Postgres, the live map, warband builder, rules editor) is in git history:

- `git checkout archive/carcass-front-v1` (its last state; `archive/carcass-front-v1-main` is its `main`);
- `git show archive/carcass-front-v1:<path>` for one file;
- `backups/carcass-front-v1.bundle` holds every branch, offline (`git clone backups/carcass-front-v1.bundle`).
