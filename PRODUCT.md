# Forgotten Letters — Product Requirements

<!-- impeccable:product-schema 1 -->

Status: draft for review · Owner: the project lead · Last updated: 2026-10-04

## 1. Summary

Forgotten Letters is a self-hosted campaign companion for **Trench Crusade**, built first for the *Carcass Front*
narrative campaign. A gaming group runs its own copy, on a laptop at the venue or on a server. The Campaign Master
records what happens at the table, the app applies the book's rules, and everyone can see the state of the
campaign on a live map.

It is rebuilt from scratch on 2026-10-03. The first version (tag `archive/carcass-front-v1`) proved the ideas but
grew without a plan. This version is built step by step, each step planned, reviewed on a visual page and
documented before it is built.

## 2. Platform

web (desktop first; other screen sizes later)

## 3. Problem

Running a narrative Trench Crusade campaign means a lot of paper: the campaign book's trackers, each warband's
roster and experience, the results of every battle, the map and its zones. The Campaign Master spends game night
on bookkeeping, players can't see where the campaign stands between sessions, and the rules for building and
growing a warband are easy to get wrong.

## 4. Users and roles

One sign-in screen serves everyone. A role decides what a person may manage; it does not stop anyone from
playing.

| Role | Who | What they do |
|---|---|---|
| **Owner** | Whoever installs and runs the copy for the group. Created on first start from `.env`. | Manages the site: invites admins and users, changes roles, disables accounts, resets passwords. There is always at least one owner. |
| **Admin** | A Campaign Master. | Runs campaigns: invites players, records battles and results, edits the campaign. Can also play. |
| **User** | A player. | Plays one or more warbands, follows the campaign, reads the map, standings and lore. |
| **Visitor** | Someone not signed in. | Sees the sign-in screen and invite pages only (public viewing may come later). |

## 5. Where and how it is used

- **Game night at a venue:** several tables play at once. The CM uses a laptop, players use their own devices,
  and a shared screen may show the map.
- **Between sessions:** players check standings, rosters and lore; the CM prepares the next session.
- **Hosting:** a group installs it with Docker Compose on a laptop or a small server. One app and one database;
  no cloud services required, works on a local network without internet.

## 6. Goals and non-goals

**Goals**

1. A group can install and run its own copy in minutes, with one command.
2. Nobody does campaign bookkeeping by hand on game night.
3. The rules of the books are applied as written; house rules are possible and visible.
4. Everyone can see the campaign's state, live, on the map.
5. The system stays understandable: every workflow, endpoint and table is documented in the architecture model.

**Non-goals (for now)**

- Multi-tenant hosting of many groups on one copy.
- Load balancing, replicas, caches or other scaling infrastructure.
- Phone and TV layouts.
- Email, OAuth or social sign-in.
- Shipping any copyrighted book content (rules text, map art, lore) with the app.

## 7. Roadmap (steps, each reviewed before it is built)

| Step | Delivers | Status |
|---|---|---|
| 0 | Foundation documents: product, design system, architecture, agents guide | in review |
| 1 | Containers, database, one sign-in for owners, admins and users, invites, account pages | planned |
| 2 | Campaigns and players: create a campaign, seats, invite players into it | later |
| 3 | Rules data: load the group's own rule packs (units, kit, keywords, limits) per edition | later |
| 4 | Warbands: build and keep a warband by the rules, experience and injuries | later |
| 5 | The live map: zones, battles, weather and effects, live for every viewer | later |
| 6 | Battles: arranging games, recording results, the campaign's consequences | later |

The order after step 1 is reviewed when step 1 is done.

## 8. Requirements for step 1 (accounts and sign-in)

**Functional**

- F1. One sign-in screen for all roles: username and password, "Remember me".
- F2. After sign-in each role lands in its own area: Owner `/owner`, Admin `/admin`, User `/home`.
- F3. A wrong password and an unknown username get the same message; five tries a minute per username and per
  address, then a wait.
- F4. The first Owner is created from `.env` on first start, only while no owner exists.
- F5. Owners invite admins and users; admins invite users. An invite is a link, valid 7 days, used once.
- F6. Owners see everyone, change roles, disable accounts (which signs them out) and reset passwords to a
  temporary one that must be changed at the next sign-in. The last owner can never be removed.
- F7. Admins see the users they invited.
- F8. Everyone can change their password and display name and sign out of every device.
- F9. Sessions last 30 days, sliding while used; only until the browser closes when "Remember me" is off.
- F10. A JSON API (`/api/v1/`) offers the same actions as the pages.

**Non-functional**

- N1. Installs with `docker compose up -d`: one app container, one PostgreSQL database; settings in `.env`.
- N2. Uses the newest stable versions of its stack (PostgreSQL 18, Node 26, SvelteKit 3, …).
- N3. Passwords are hashed (scrypt); only hashes of session and invite tokens are stored.
- N4. Every endpoint validates its input, returns one error shape with a request id, and is documented.
- N5. If the database is unavailable the app says so clearly and recovers on its own.
- N6. Desktop browsers at 1366–1920 px wide; keyboard usable; text contrast at least WCAG AA.

## 9. Terminology

Use the book's words in the interface and the code: Campaign Master (CM), warband, Aggressor and defender,
Entry Zone, Special Zone, Outpost, supply, Exploration, Glory, Ducats, Campaign Victory Points (CVP), Hell on
Earth, Visions, Omens. "Owner", "Admin" and "User" are the app's roles; in the interface an Admin is called a
Campaign Master where that reads better.

## 10. Content and copyright

Trench Crusade is the property of Factory Fortress Inc. The app claims no affiliation and uses no official logos.
The books (`docs/Trench Crusade`, `docs/Factions`), the rule packs read from them (`docs/packs`) and the campaign
map (`assets/map`) belong to each group's own copy and are never committed or bundled. Blender-made effects and
seals (`assets/blender`, `assets/fx`) are the project's own.

## 11. Success measures

- A new group installs it and signs in as owner in under 10 minutes, following the README.
- A game night where the CM records every result in the app and nobody tracks the campaign on paper.
- Every step ships with its checks passing and the architecture model in agreement with the code.

## 12. Open questions

- Should a visitor be able to see the live map and standings without signing in (a public view for the room)?
- Which step follows step 1: campaigns (2) or rules data (3)?
