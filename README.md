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

2. **Start it**, choosing the Campaign Master's password (and, optionally, the database's):

   ```sh
   ADMIN_PASSWORD='something-secret' POSTGRES_PASSWORD='another-secret' docker compose up -d --build
   ```

   This runs two containers: the app and PostgreSQL.

3. Open **http://localhost:3000/admin**, log in, and found the campaign: number of players,
   games per player, house zones and house rules. Then muster the warbands (portrait and
   faction symbol uploads), deal the Visions, and arrange the first game.

4. Players open **http://&lt;this machine's LAN address&gt;:3000** on the same network, e.g.
   `http://192.168.1.20:3000` (`ip -4 addr` or `hostname -I` shows it).

5. **Make the players' accounts.** Sign in as `cm` with `ADMIN_PASSWORD` (you'll be asked to choose
   your own password), then open *Players* in the admin menu: create each player's account with
   a username, let a password be generated, and tick the seat they play. They sign in at `/login`,
   choose their own password, and can then edit their own warband's seal, pictures and roster. The
   *Players* page also resets passwords, disables accounts and signs them out everywhere.

Campaign data lives in PostgreSQL (the `pgdata` volume); uploaded portraits, symbols, seals
and models live in the `data` volume. Both survive restarts and rebuilds. An older install's
SQLite campaign (`/data/campaign.db`) is copied into Postgres automatically on first start and
the old file is kept as `campaign.db.imported`. **Backup** in the admin menu downloads everything as one JSON file —
keep one after each game night. `docker compose down -v` deletes the volumes and all data.

### Rules: the compendium and the warband builder

The compendium (core rules, campaign and scenarios, units, battlekit, keywords) and the warband builder read the rules from your
own copies of the books, which are copyrighted and so not in the repo. Generate the data locally
(needs `pdftotext` from poppler-utils):

```sh
python3 app/scripts/import-rules.py "docs/Trench Crusade/Base/v1.0.2/Warbands-of-Trench-Crusade.pdf" \
    --carcass "docs/Trench Crusade/Carcass Front/Carcass Front.pdf" \
    --rulebook "docs/Trench Crusade/Base/v1.0.2/Trench-Crusade-Digital-Rulebook.pdf" -o rules.json
```

The scenario pages carry their battlefield maps, cropped from your books into `rules.json` (like the
text, they stay out of git). Then load `rules.json` in *Admin → Rules* (or drop it in the `data` volume as `/data/rules.json`
before the first start). The reader is a best effort: check entries against the books in
*Admin → Rules*, correct them, and mark them verified — verified entries survive a re-import.

### Your own factions: the Faction Studio

*Admin → Faction Studio* writes factions and variants the books don't have, and changes book entries as house rules.

- **Template file.** Download `faction-template.yaml`, fill it in, and import it; the Studio previews what it will add or replace
  before applying. The template is commented and lists every key:
  - alignment, unit and item kinds, Type, currency;
  - the armoury stipulations (*X only*, per model, Shield Combo, Bayonet Lug, Consumable, Headgear, Exploration only);
  - the variant rules (starting money, excluded, must include, leader, caps, free items, Fireteams, keyword upgrades);
  - unit kit (fixed items, no other armour…, nothing else, swaps) and mercenary hiring;
  - every keyword in your glossary, and a worked example faction.
- **Editor.** Each faction has tabs for identity (colours for its seal), rules, units, armoury, keywords and its own YAML. Any faction,
  including a book one, can be downloaded as a template.
- **Book entries.** A book entry edited in the Studio is marked *house rule* and kept through re-imports; *Revert to book* restores it.
  Structured values set here win over what the builder reads from the rule text.
- **Where it shows.** Authored factions appear in New Warband, the builder and the compendium, and go into backups.

### Viewing from outside the venue

The app only listens on your network. To let players check the map from home before a real
server deployment, put a tunnel in front of port 3000 (e.g. Tailscale or Cloudflare Tunnel).

## Using it

| Where | Who | What |
| --- | --- | --- |
| `/` | everyone | Live map. Tap a zone or a warband; *Standings*; *Weather on/off* per device. |
| `/players`, `/players/<id>` | everyone | Standings and each warband's digital Campaign Tracker. |
| `/campaign` | everyone | The campaign: players, warbands and standings. |
| `/warbands/<id>` | everyone (the player and CM edit) | The warband: summary, models, battlekit, campaign record; the builder. |
| `/compendium` | everyone | Core rules, campaign, scenarios, units, battlekit and keywords from your rulebooks; search. |
| `/warbands` (menu: Warband Builder) | signed-in users | Your warband lists and campaign warband: build, duplicate, print, play, and use a list for the campaign. |
| `/warbands/new` | signed-in users | New list (or your campaign warband): pick a faction or variant; starting money follows its rules (e.g. Papal States 500 Ducats, 11 Glory). |
| `/warbands/<id>` | everyone (lists: owner) | The builder: recruiting, battlekit, upgrades, Fireteams, checked against the books; `/play`, `/print`, `/export`. |
| `/?battle=<game>` | everyone | Enter a battle being fought (click its zone); the result plays on every screen when it's recorded. |
| `/zones`, `/zones/<id>` | everyone | Zone lore, resources, Outposts and battles fought there (each can be replayed on the map). |
| `/history` | everyone | The chronicle of battles. |
| `/admin` | Campaign Master | Campaign settings, final-reckoning preview, Vision reveal. |
| `/admin/games` | Campaign Master | Arrange a game → record its result. Up to 8 games at once. |
| `/admin/adjustments` | Campaign Master | Glory→CVP trades, Tithe Ducats, corrections. |
| `/admin/warbands/<id>` | Campaign Master | Muster roll, roster builder, map models (STL → token), Vision. |
| `/admin/factions` | Campaign Master | Default outpost and figure models per faction. |
| `/admin/lore` | Campaign Master | Edit each zone's lore. |
| `/admin/players` | Campaign Master | Player accounts: create, reset passwords, disable, assign seats. |
| `/admin/rules` | Campaign Master | Load and correct the rules data from `import-rules.py`, including each faction's and variant's special rules (which the builder reads). |
| `/admin/studio` | Campaign Master | Faction Studio: author factions, variants, units and armoury (YAML template or forms); house-rule book entries. |
| `/admin/weather` | Campaign Master | Live weather console, portents, regional weather, zeppelin events. |
| `/admin/visions`, `/admin/backup` | Campaign Master | Deal Visions; export / restore. |

Vision cards stay secret: no public page or live update contains them until the Campaign
Master ticks *Reveal Vision cards* on the campaign page.

Map models: upload an STL on a warband's page (or a faction default on *Factions*), pose it,
and *Save token*. The browser renders it once to a transparent image, so the live map stays
light on phones; the STL is kept for re-rendering but never served publicly.

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
docker compose up -d db   # from the repo root: Postgres on the compose network
npm run dev          # http://localhost:5173 (app/.env: DATABASE_URL=postgres://…, ADMIN_PASSWORD)
npm test             # rules-engine tests
npm run check        # type-check
npm run db:generate  # after editing src/lib/server/db/schema.ts (migrations run on start)
```

### Blender (effect sprites)

The Blender scenes behind the effects are kept in `app/assets/blender/*.blend` (open and tweak
them there). Re-save them after changing `render_fx.py` with
`FX_BLEND_DIR=app/assets/blender FX_BLEND_ONLY=1 blender --background --factory-startup --python app/scripts/fx/render_fx.py -- /tmp/x`.
The seal scenes (`app/assets/blender/seals/`) contain the faction logos and are not committed.

Lightning strikes, hellfire bursts, crows, smoke puffs, the biplane, the zeppelin and the
default outpost tokens on the live map are rendered in Blender and packed into sprite sheets in `app/static/fx/`; the map falls back to drawn
effects if they fail to load. To regenerate them (headless, about a minute; your open Blender
session is not touched):

```sh
blender --background --factory-startup --python app/scripts/fx/render_fx.py -- /tmp/fx-frames
python3 app/scripts/fx/pack_fx.py /tmp/fx-frames app/static/fx
```

**Faction seals** are rendered in two passes (a neutral medallion and a light mask) so each
warband's metal and light colours are applied live. Put your own copies of the six faction logos under `docs/Factions/<Faction>/` (gitignored; the expected paths are listed in `app/scripts/fx/render_sigils.py`), then:

```sh
blender --background --factory-startup --python app/scripts/fx/render_sigils.py -- docs/Factions /tmp/seal-frames
python3 app/scripts/fx/pack_sigils.py /tmp/seal-frames app/src/lib/assets/sigils
```

and rebuild. Without them the app shows each warband's uploaded symbol instead.

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
