# Carcass Front — Campaign Tracker

A local-first web app for running a **Trench Crusade: Carcass Front** map campaign.
The Campaign Master records games; every player follows the campaign on a live map
from their own phone or browser.

- **Live map**: every warband's portrait and faction symbol on the Carcass Front map,
  Outposts, battles in progress, pinch-zoom on phones, updates the moment a result is saved.
- **Rules engine**: Campaign Tracker boxes and rewards, CVP, Exploration dice, Camp buildings,
  Scouting, Outposts, supply chains, Omens of Leviathan, Visions, Shared Objectives.
- **Post-game wizard**: legal zones for the Aggressor, scenario lookup, Hell on Earth weather
  roll, Exploration results, reward choices, live preview of what the game does.
- **Weather**: each battle's Hell on Earth event is drawn at its zone; regional weather set by
  the Campaign Master; live rain, storms, fog, hellfire, crows… and one-shot lightning strikes.
- **Players**: 2–12 on the official map, up to 16 with our house zones (Entry Zones E & F and
  zones 1–6 from the Player's Guide), switchable per campaign.

## Run it

Requires Docker.

1. **Extract the map.** The map art belongs to the Carcass Front book, so it isn't in the repo.
   Generate it from your copy (needs `pdfimages` from poppler-utils and Python Pillow):

   ```sh
   python3 app/scripts/extract-map.py "docs/Trench Crusade/Carcass Front/Carcass Front.pdf"
   ```

2. **Start it**, choosing the Campaign Master's password:

   ```sh
   ADMIN_PASSWORD='something-secret' docker compose up -d --build
   ```

3. Open **http://localhost:3000/admin**, log in, and found the campaign: number of players,
   games per player, house zones and house rules. Then muster the warbands (portrait and
   faction symbol uploads), deal the Visions, and arrange the first game.

4. Players open **http://&lt;this machine's LAN address&gt;:3000** on the same network, e.g.
   `http://192.168.1.20:3000` (`ip -4 addr` or `hostname -I` shows it).

Data (SQLite database and uploaded images) lives in the `data` Docker volume and survives
restarts and rebuilds. **Backup** in the admin menu downloads everything as one JSON file —
keep one after each game night. `docker compose down -v` deletes the volume and all data.

### Viewing from outside the venue

The app only listens on your network. To let players check the map from home before a real
server deployment, put a tunnel in front of port 3000 (e.g. Tailscale or Cloudflare Tunnel).

## Using it

| Where | Who | What |
| --- | --- | --- |
| `/` | everyone | Live map. Tap a zone or a warband; *Standings*; *Weather on/off* per device. |
| `/players`, `/players/<id>` | everyone | Standings and each warband's digital Campaign Tracker. |
| `/history` | everyone | The chronicle of battles. |
| `/admin` | Campaign Master | Campaign settings, final-reckoning preview, Vision reveal. |
| `/admin/games` | Campaign Master | Arrange a game → record its result. Up to 8 games at once. |
| `/admin/adjustments` | Campaign Master | Glory→CVP trades, Tithe Ducats, corrections. |
| `/admin/weather` | Campaign Master | Live weather console, portents, regional weather. |
| `/admin/visions`, `/admin/backup` | Campaign Master | Deal Visions; export / restore. |

Vision cards stay secret: no public page or live update contains them until the Campaign
Master ticks *Reveal Vision cards* on the campaign page.

### Rulings built in (all from the book unless noted)

- Glory box *n* scores *n* CVP as printed (campaign setting: or deeds-as-CVP, or none).
- Random scenarios last 4 turns per the Player's Guide (campaign setting; the map says 6).
- Weather: the player with fewer **tracker** CVP picks between the two 2D6 rolls; ties roll off.
- Only the first Outpost at Domus, Nineveh, Steel Necropolis or the Sword of God takes its Omen.
  *House:* every Outpost at Amoudet Seawall gains one, as the guide words it.
- A draw gives no Conquest box and no Outpost; it still counts as a turn as Aggressor.
- Anything the tracker can't know (Glory from base-game rules, recurring Tithe Ducats,
  most Vision evidence) is recorded by the Campaign Master as an adjustment or Vision level.

## Develop

```sh
cd app
npm install
npm run dev          # http://localhost:5173 (uses app/.env: DATABASE_URL, ADMIN_PASSWORD)
npm test             # rules-engine tests
npm run check        # type-check
npm run db:generate  # after editing src/lib/server/db/schema.ts (migrations run on start)
```

### Blender (effect sprites)

Lightning strikes, hellfire bursts, crows and smoke puffs on the live map are rendered in
Blender and packed into sprite sheets in `app/static/fx/`; the map falls back to drawn
effects if they fail to load. To regenerate them (headless, about a minute; your open Blender
session is not touched):

```sh
blender --background --factory-startup --python app/scripts/fx/render_fx.py -- /tmp/fx-frames
python3 app/scripts/fx/pack_fx.py /tmp/fx-frames app/static/fx
```

For interactive work, the repo's `.mcp.json` registers Blender Lab's official MCP bridge for
Claude Code; the bridge itself is downloaded, not committed:

```sh
mkdir -p tools/blender-mcp && cd tools/blender-mcp
curl -LO https://projects.blender.org/lab/blender_mcp/releases/download/v1.0.3/blender-1.0.3.mcpb
unzip blender-1.0.3.mcpb -d bundle && (cd bundle && uv sync)
```

In Blender 5.1+ install the MCP add-on
([mcp-1.0.3.zip](https://www.blender.org/lab/mcp-server/)), enable it and start its server
(port 9876), then start Claude Code in this folder and approve the `blender` server.

Stack: SvelteKit 2 (Node adapter), SQLite + Drizzle, Server-Sent Events for live updates,
PixiJS 8 + pixi-viewport for the map and weather, sharp for image uploads.

```
app/src/lib/rules/    rules engine — pure TypeScript, unit-tested (zones, tracker, engine, legality, scoring, visions, weather)
app/src/lib/fx/       weather renderer (PixiJS) and what to show for a snapshot
app/src/lib/server/   database, public snapshot, live hub, uploads, backups, weather scheduler
app/src/routes/       (public) pages, /admin, /api/stream
```

*Trench Crusade and Carcass Front are © Factory Fortress Inc. This is an unofficial fan tool;
bring your own copy of the rules.*
