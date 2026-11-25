# Forgotten Letters

A campaign tracker for Trench Crusade's *Carcass Front*, starting over on 2026-10-03: SvelteKit and PostgreSQL in
Docker Compose, rebuilt step by step.

## Install

You need Docker (Docker Desktop, or Docker Engine with the Compose plugin). Everything the app needs ships in the
image; it works with no internet connection.

1. Put `compose.yaml`, `Caddyfile`, `.env.example` and `start.sh` (`start.ps1` on Windows) in a folder.
2. Start it: `./start.sh` (Windows: `.\start.ps1`). The first time it makes `.env` from `.env.example` with a new
   database password. It picks the first free port of 3000 to 3005, writes it into `.env` and runs
   `docker compose up -d`. If every port is taken it says so and starts nothing; set other ports with `PORTS` in
   `.env`.
3. In `.env`, set `ORIGIN` to the address people type: `http://<this machine's IP>:<port>` on a LAN,
   `https://<DOMAIN>` with HTTPS. Run `./start.sh` again after changing `.env`.
4. Open the address in a browser. Until an owner exists every page leads to the welcome page: press **Setup** and
   follow the three steps (owner account, look, done). The log also says where: `docker compose logs app |
   grep "Setup is open"`. Whoever opens a fresh install first becomes its owner, so set it up right away.

Plain `docker compose up -d` still works with a fixed `APP_PORT` in `.env` (copy `.env.example` to `.env` and set
`POSTGRES_PASSWORD` first).

**More:** the port and address, HTTPS, every setting, backups, updates and getting back in are in the guide
(`guide/`, built with [Zensical](https://zensical.org): `cd guide && uvx zensical@0.0.74 serve`).

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
| `guide/` | The user guide (Zensical): install, port, HTTPS, settings, backups. |
| `tools/atlas/` | The architecture atlas (LikeC4 model, map and checks). |
| `tools/blender-mcp/` | The Blender MCP bridge (see `.mcp.json`). |

## The first version

The whole first app (SvelteKit, Postgres, the live map, warband builder, rules editor) is in git history:

- `git checkout archive/carcass-front-v1` (its last state; `archive/carcass-front-v1-main` is its `main`);
- `git show archive/carcass-front-v1:<path>` for one file;
- `backups/carcass-front-v1.bundle` holds every branch, offline (`git clone backups/carcass-front-v1.bundle`).
