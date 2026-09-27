# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Campaign Master (CM):** runs a Trench Crusade *Carcass Front* narrative campaign for their group. The CM is the only editor: defines players and warbands, arranges battles, rolls Hell on Earth, records results through the post-game wizard, tunes the weather, edits lore and rosters, and deals and reveals Vision cards. Usually works from a laptop at the venue on game night, and between sessions.
- **Players (8–12 suggested for the official map; the app extends to 16, fewer also works):** each commands one warband. They watch the campaign, read-only, on their own phones at the table, and check standings, rosters and zone lore between game nights.
- **The room:** a shared TV or projector at the venue shows the live map to everyone during game night.
- **Other groups:** the app is meant to be shared and self-hosted by other Trench Crusade groups, so setup, documentation and defaults must work for a CM who has never seen it.

## Product Purpose

A local-first, self-hosted campaign tracker that turns the *Carcass Front* campaign book's paper tracking into a live, shared map. The CM records what happens, the rules engine computes the consequences (tracker CVP, resources, outposts, supply, exploration, Visions), and every open screen updates live. Success is a game night where nobody does campaign bookkeeping by hand, every player can see where the campaign stands, and the map makes the campaign feel alive.

## Positioning

A campaign table, not a list builder: the live map is the centre. It pairs a rules engine faithful to the *Carcass Front* book (with the group's Player's Guide house zones) with a map that reacts to play: rules-driven weather (Hell on Earth rolled per game, plus CM-defined regional weather), planned battles, dice rolled for everyone to see, outposts, aircraft and zeppelin events. Roster keeping follows Trench Companion's structure, but lives inside the campaign rather than beside it.

## Operating Context

- Game night at a shared venue: several tables playing at once (up to 8 games in parallel), a big screen showing the map, players on phones, the CM on a laptop.
- Runs on a LAN via Docker Compose; a single SQLite volume holds everything, and there is a JSON backup export/restore. Updates stream over Server-Sent Events.
- Between sessions: players browse standings, the chronicle of battles, rosters and zone lore; the CM prepares events and weather.
- The group's rules references are the *Carcass Front* campaign book, the Hell on Earth chart, and their own Player's Guide.

## Capabilities and Constraints

- Accounts are made by the Campaign Master (no self sign-up). The CM edits everything; each player edits only the warbands of the seat(s) their account plays (seal, pictures, roster via the builder). Everything else is read-only to them.
- Vision cards stay secret: no public page or live update carries them until the CM reveals them.
- The campaign book's map art and lore are copyrighted: they are never committed. Each group extracts the map (`app/scripts/extract-map.py`) and imports lore (`import-lore.py`) locally from their own copy of the book.
- Rules data (units, battlekit, keywords) comes only from each group's own rulebooks via the local `import-rules.py`; it is never committed or bundled. Trench Companion lists can be imported per warband, and must match the warband's faction.
- Weather and effects must stay light on phones: effects scale with device capability and respect reduced motion; 3D models are rendered once into flat tokens rather than drawn live.
- Terminology follows the book: Campaign Master, warband, Aggressor/defender, Entry Zone, Special Zone, Outpost, supply, Exploration, Glory, Ducats, CVP, Hell on Earth, Visions, Omens.

## Brand Commitments

- Name: **Carcass Front**, a campaign tracker for Trench Crusade.
- **Binding:** the look must stay faithful to the *Carcass Front* book itself, in both of its registers: rulebook pages (bright white paper, black ink, red blackletter section heads, small-caps sub-heads over red rules, grey-wash rules boxes) for everything read or filled in, and the painted night (dark, smoky, fire-lit, like the cover and art spreads) around the live map. The book-accurate campaign map stays. This supersedes the earlier cream-parchment Player's Guide look (changed at the user's direction, 2026-09-27).
- **Exception, warband pages:** `/warbands/<id>` deliberately follows Trench Companion's warband page (its layout and its dark look: grey panels over a blurred image, red section bands), because the group plays with Trench Companion and wants its warbands to feel the same. Trench Companion's name, logo and art are never copied.
- Trench Crusade is the property of Factory Fortress Inc.; the app does not use official logos or claim affiliation.

## Evidence on Hand

- Player's Guide house-zone lore, seeded in `app/src/lib/lore-seed.ts`.
- Blender-rendered effect and token sprite sheets in `app/static/fx/`.
- No testimonials, user counts, or external endorsements exist; do not fabricate any.

## Product Principles

1. **The map is the campaign.** State, events and drama show up on the map first; tables and forms support it.
2. **Faithful to the book.** Rules are computed as written, with house rules clearly marked; the CM can override, and overrides are visible.
3. **The CM records, the app computes.** Minimise bookkeeping and data entry at the table; never ask for a value the app can derive.
4. **Secrets stay secret.** Hidden information (Visions) never leaks into public views.
5. **Runs anywhere a group plays.** Self-hosted, offline-friendly, light on phones, and understandable to a group that has never used it.
