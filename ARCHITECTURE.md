# Architecture

Where everything lives, how the layers connect, and where new code goes. Product and look are in `PRODUCT.md` and
`DESIGN.md`; running it is in the README.

```
 browser (players' phones, the TV, the CM's laptop)
   │  pages, form posts, SSE (/api/stream)
   ▼
 Caddy (https profile only: TLS, X-Forwarded-For) ──► app container :3000
                                                        │  SvelteKit (adapter-node) + server.js
                                                        │   hooks.server.ts → access gate → routes
                                                        ├──► PostgreSQL   all state (volume pgdata)
                                                        ├──► Redis        cache, rate limits, live fan-out, locks
                                                        └──► /data        uploads (volume data)
```

## Services (compose.yaml)

| Service | What it holds | Survives a restart? |
|---|---|---|
| `carcass-front` | The app: SvelteKit server (`app/server.js`), graceful shutdown on SIGTERM, health at `/health` | stateless |
| `db` (Postgres 17) | Every campaign record, account, session, rule, log | yes (`pgdata`) |
| `redis` (7) | Snapshot cache, session cache, rate-limit counters, cross-instance live updates, startup lock | no: rebuilt from Postgres |
| `caddy` (profile `https`) | TLS for `DOMAIN`, passes the client address in `X-Forwarded-For` | certificates (`caddy_data`) |
| volume `data` | Uploaded maps, portraits, symbols, seals, model tokens and STLs (`/data/uploads`) | yes |

Settings come from `.env` (see `.env.example`). The ones that change behaviour:
- **`ACCESS`:** `open` or `private` (see Access below).
- **`ADMIN_USERNAME` / `ADMIN_PASSWORD`:** the Campaign Master account, re-applied at every start.
- **`ADDRESS_HEADER` / `XFF_DEPTH`:** where the real client address comes from behind a proxy.
- **`DOMAIN` / `COMPOSE_PROFILES`:** HTTPS.

## Database (`app/src/lib/server/db/schema.ts`)

Drizzle on Postgres. Migrations live in `app/drizzle`, generated with `npm run db:generate` and applied at start inside
`withStartupLock`, so parallel starts never race.

| Group | Tables |
|---|---|
| Campaign | `campaign`, `player` (seats), `warband`, `game`, `adjustment`, `round`, `round_entry`, `challenge`, `invite` |
| Map | `map_zone`, `zone_lore`, `region_weather`, `fx_state` |
| Rosters | `unit`, `warband_stash`, `model`, `unit_art` |
| Rules | `rules_unit`, `rules_item`, `rules_keyword`, `rules_faction`, `rules_page`, `custom_faction` |
| Accounts | `user`, `session`, `account_request`, `audit_log`, `user_activity` |

## Backend (`app/src/hooks.server.ts`, `app/src/lib/server/*`)

**`hooks.server.ts` runs on every request, in this order:**
1. Read the session.
2. Apply the access gate (`access.ts`).
3. Count activity.
4. Resolve the request.
5. Invalidate the cached snapshot after a change.
6. Write the admin audit entry.

`init` runs once at start: migrations, the `.env` admin, rules, the Faction Studio seed, zones, and the weather timer.

| Module | Owns |
|---|---|
| `access.ts` | Who may reach what, in either mode: one pure, tested decision |
| `auth.ts`, `signin.ts`, `passwords.ts`, `admin-sync.ts` | Sessions and cookies, the two sign-in doors, password hashing, the `.env` admin |
| `requests.ts`, `request-rules.ts` | Account and reset requests |
| `muster.ts`, `rounds.ts` | Campaign stages, seats and invites, rounds of battles |
| `campaign.ts`, `games.ts`, `warbands.ts`, `roster.ts`, `builder.ts` | Campaign state, battles, warbands and their builder |
| `public.ts`, `snapshot-cache.ts`, `hub.ts` | The public snapshot, its Redis cache, and the live fan-out (SSE and Redis pub/sub) |
| `fx.ts`, `map.ts`, `lore.ts` | Weather and effects, the map image and zones, zone lore |
| `rules-data.ts`, `studio.ts`, `factions.ts`, `starter.ts` | Rules from the books, the Faction Studio, the starter pack |
| `backup.ts` | Export, restore, fresh start |
| `uploads.ts`, `models.ts`, `unit-art.ts` | Files on the `data` volume |
| `audit.ts`, `activity.ts` | The account and admin log, request counts, the client address |
| `kv.ts`, `redis.ts`, `db/` | Store adapters (Redis, or in-memory without `REDIS_URL`) and the database |

**Rule:** routes call these modules. A route that queries `db` directly is fine only when no module owns that data yet.

## APIs

Pages use **form actions** to write (`+page.server.ts` `actions`, progressively enhanced with `use:enhance`). JSON and
stream endpoints live under `routes/api`:

| Endpoint | Method | Who | Returns |
|---|---|---|---|
| `/api/stream` | GET | anyone in `open`; signed in in `private` | SSE: `snapshot`, `clock`, `trigger` events (the live map) |
| `/api/round` | GET, POST | the round's players and the CM | The current round; picks and challenges |
| `/api/battle-result/[id]` | GET | as `/api/stream` | A finished battle's result, for the replay |
| `/api/seal/[id]`, `/api/unit-photo/[id]` | POST | the warband's player, the CM | Saves a seal or a unit picture |
| `/api/models` | POST | the CM; a player for their own warband | Saves a rendered model token (and its STL) |
| `/api/models/[id]` | DELETE | as above | Removes a model |
| `/api/models/[id]/stl` | GET | as above | The STL source (never public) |
| `/admin/api/battles`, `/admin/api/battles/[id]` | POST | the CM | Arrange a battle; record or change one |
| `/admin/api/battles/options` | GET | the CM | Who may fight where (for the arrange dialog) |
| `/uploads/[...path]` | GET | as `/api/stream` | Uploaded images |
| `/health` | GET | anyone | `{ ok: true }` once the database answers |

**The live path:**
1. A change publishes through `hub.publish`.
2. `public.ts` builds the snapshot, and Redis caches it.
3. `/api/stream` pushes it to every open page.
4. `lib/live.svelte.ts` hands it to the components.

Vision cards never enter the public snapshot.

## Frontend (`app/src/routes`, `app/src/lib`)

**Route groups:**
- **`(public)`:** the live map, standings, zones, chronicle, compendium, warbands, muster and settings. Visitors are allowed in `open` mode.
- **`admin`:** the Campaign Master's console and setup pages.
- **`login`, `join`:** the door.
- **`+error.svelte`:** every error, on a book page with a way back.

**Shared code:**
- **Components:** `lib/components`, e.g. `LiveMap` (PixiJS), `NavPanel`, `BattleHud` and the dialogs.
- **Pure modules in `lib/*`:** these are client-safe and unit-tested: rules engine, warband rules, campaign flow, templates.
- **Server-only code:** `$lib/server` must never be imported by a component.
- **Effects:** `lib/fx` (engine, sky, battle, wanted) is loaded only in the browser.

## Access

`lib/server/access.ts` decides, `hooks.server.ts` carries it out, and `access.spec.ts` tests every case.

| | Signed out | Player | Campaign Master |
|---|---|---|---|
| `ACCESS=open` (a LAN at the venue) | Watches: map, standings, zones, compendium, the live stream | + their own warband, the round, settings | everything |
| `ACCESS=private` (deployed) | Only `/login`, `/admin/login` and `/join/<invite>`; pages redirect to the door, data answers 401 | as open | everything |

**Rules in both modes:**
- **Temporary passwords:** an account with one reaches only Settings until it chooses its own.
- **Two doors:** players sign in at `/login`, the Campaign Master at `/admin/login` (`lib/server/signin.ts`). Signed out, `/admin` leads to the CM's door; each door refuses the other's accounts as if the password were wrong. The CM's door limits per address only, so guessing can't lock the CM out.
- **Admin pages:** a player on `/admin` gets a 403 page, never a redirect.
- **After sign-in:** the visitor returns to `next` only when they may open it.

## Tests

| Kind | Where | Run |
|---|---|---|
| Unit | Next to the module (`*.spec.ts`), node | `cd app && npm test` |
| End-to-end: sign-in and access | `app/e2e/*.spec.ts` (Playwright), on a throwaway stack in both modes | `./scripts/e2e.sh` |
| Manual, on real devices | `TESTING.md` | per release |
