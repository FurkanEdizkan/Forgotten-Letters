# Forgotten Letters: Product Requirements

<!-- impeccable:product-schema 1 -->

Status: agreed 2026-10-21 · source: the blueprint review

## 1. Summary

**A self-hosted campaign companion for Trench Crusade, built first for the Carcass Front.**

Forgotten Letters is a fan-made web app. Each gaming group runs its own copy, on a laptop at the venue or on a
small server. The Campaign Master (CM) runs the campaign in it, players submit their battle results, the app
applies the book's rules and proposes the consequences, and everyone sees the state of the campaign on a live
map.

The app is a companion. It does not replace the books or the table: there is no dice rolling and no
turn-by-turn battle play.

The app was rebuilt from scratch on 2026-10-03. The first version (tag `archive/carcass-front-v1`) proved the
ideas but grew without a plan. This version is built one step at a time. Each step is planned, reviewed on a
visual page and documented before it is built.

Trench Crusade is named only to describe what the app is for. The app is unofficial and not affiliated with
Factory Fortress Inc. (see §13).

## 2. Platform

web

Desktop browsers first (1366–1920 px wide). Phone and TV layouts come later.

## 3. Problem

Running a narrative Trench Crusade campaign means a lot of paper: the campaign book's trackers, each warband's
roster and experience, the result of every battle, the map and its zones.

- The CM spends game night on bookkeeping instead of playing or adjudicating.
- Players cannot see where the campaign stands between sessions.
- The rules for building and growing a warband are easy to get wrong.
- House rules and errata live in people's heads, so nobody is sure which version applies.

## 4. Audience

The **Campaign Master comes first, players second.** Every step must make the CM's work faster. Player features
follow once the CM can run a night without paper.

A typical copy serves one group: 5 to 30 people, with about a dozen online at once on game night.

## 5. Users and roles

One sign-in screen serves everyone. A role decides what a person may manage. It never stops anyone from playing:
any role can hold a seat in any campaign.

### 5.1 Site roles (step 1)

Site roles are ordered **Owner > Admin > User**. A higher role can do everything a lower one can.

| Role | Who | What they do |
|---|---|---|
| **Owner** | Whoever installs and runs the copy. The first Owner is created through a one-time setup link. | Manages the site: accounts, roles, invites, backups, rule packs, the map, the audit log. There is always at least one Owner. |
| **Admin** | A Campaign Master. Shown as "Campaign Master" in the interface where that reads better. | Runs campaigns from step 2. Invites users to the site. Can also play. |
| **User** | A player. | Plays one or more warbands, follows the campaign, reads the map and standings. |
| **Visitor** | Someone not signed in. | Sees the sign-in, setup and invite pages only. |

### 5.2 Campaign roles (step 2)

Membership is per campaign and separate from the site role.

| Campaign role | Who | Notes |
|---|---|---|
| **Campaign Master (CM)** | The Admin who created the campaign. | Runs the campaign: seats, results, overrides, house rules. |
| **Co-CM** | Another Admin added by the CM. | Same rights as the CM in that campaign. |
| **Player** | Any signed-in person with a seat. | Admins and Owners can hold seats too, including in a campaign they run. |

When a CM edits their own warband, the app records it as a CM action, so it is clear the CM changed their own
data.

### 5.3 Permissions (step 1)

| Action | Owner | Admin | User |
|---|---|---|---|
| Sign in, change own display name and password | yes | yes | yes |
| Sign out of every device | yes | yes | yes |
| Invite users | yes | yes | no |
| Invite admins or owners | yes | no | no |
| See the users they invited | yes (everyone) | yes | no |
| Change roles (promote or demote) | yes, never the last Owner | no | no |
| Disable an account (ends its sessions) | yes | no | no |
| Reset a password to a temporary one | yes | no | no |
| Anonymise a disabled account | yes | no | no |
| View the audit log | yes | no | no |
| Download or restore a backup | yes | no | no |
| Upload rule packs and the map (from steps 3 and 5) | yes | no | no |

Nobody can permanently delete an account. A disabled account keeps its history.

## 6. Where and how it is used

| Moment | What happens | What it needs |
|---|---|---|
| **Game night at a venue** | Several tables play at once. Players submit their own results on their devices. The CM moves between tables and confirms or corrects each result from a queue. | Fast, forgiving entry. Results reach the CM's queue live. |
| **Between sessions** | Players check standings and campaign trackers (CVP, Glory, Hell on Earth and similar), manage their warband (spend experience, buy kit, handle injuries), browse the map and battle history, and arrange games with opponents. The CM prepares the next night. | Clear, detailed pages read at leisure. |
| **Shared room screen** | The campaign is shown to the whole room. | Planned for step 5: a display mode with large type, no controls and live updates. Until then, a signed-in browser in full screen. |

**Devices.** Desktop first. Pages must not break on a phone but are not designed for it. Revisit phone layouts
before step 6, when players submit results at the table.

**Liveness.** From step 5 the map, the campaign trackers and the result queue update live (Server-Sent Events
from the single app process). Other pages refresh on navigation.

## 7. Hosting and distribution

| Topic | Decision |
|---|---|
| **Install** | Docker Compose: one app container (Node 26, SvelteKit 3) and one PostgreSQL 18 container. Download the compose file and `.env.example`, fill in `.env`, run `docker compose up -d`. |
| **Where it runs** | The same image on a laptop on the venue network or on a small server. Docs cover both: a laptop on Wi-Fi, and a small VPS behind a reverse proxy. |
| **Internet** | Works fully on a local network without internet. Fonts and icons ship in the image. No CDN, analytics, telemetry or outbound calls at runtime. Only pulling the image needs internet. An update check runs only when the copy is online. |
| **HTTPS** | The app serves HTTP. An optional Caddy 2 profile (`https`) adds automatic certificates on internet servers. Plain HTTP on a LAN is accepted, with a warning in the Owner area. Secure cookies turn on when served over HTTPS. |
| **Updates** | `docker compose pull` then `docker compose up -d`. On start the app writes a database dump, then applies migrations. Releases are tagged versions plus a `latest` tag. Release notes list breaking changes. |
| **Backups** | The app writes a daily dump to a backups volume and keeps the last 14 days. The Owner can download a backup or restore one from the Owner area. |
| **Health** | `GET /health/live` (process up, used by the Docker healthcheck) and `GET /health/ready` (database reachable and migrations applied; 503 while starting or shutting down). |
| **Scale** | One app and one database. No Redis, load balancer, replicas or other services. |
| **Licence** | AGPL-3.0. Anyone may self-host and modify it. Anyone who offers it over a network must share their changes. |

## 8. Goals and non-goals

**Goals**

1. A group installs and runs its own copy in minutes, with one command.
2. Nobody does campaign bookkeeping by hand on game night.
3. The book's rules are applied as written; house rules are possible and visible.
4. Everyone sees the campaign's state, live, on the map.
5. The system stays understandable: every workflow, endpoint, service and table is documented in the
   architecture model.

**Out of scope for now**

1. Multi-tenant hosting of many groups on one copy.
2. Load balancing, replicas, Redis or other scaling infrastructure.
3. Phone and TV layouts.
4. Email, OAuth or social sign-in.
5. Shipping any copyrighted book content (rules text, map art, lore, rule packs).
6. Chat and messaging.
7. Dice rolling or turn-by-turn battle play inside the app.

## 9. Roadmap

Each step is planned, reviewed on a visual page and documented before it is built.

| Step | Delivers | Status |
|---|---|---|
| 0 | Foundation documents: product, design system, architecture, agents guide | agreed |
| 1 | Accounts and sign-in: containers, database, one sign-in for Owners, Admins and Users, invites, account pages, Owner area | built 2026-10-21 on `feat/accounts`, in review (new decisions: ARCHITECTURE 32–35) |
| 2 | Campaigns and seats: create a campaign, CM and co-CMs, seats, invite players into it | later |
| 3 | Rules data: load the group's own rule packs (units, kit, keywords, limits) per edition and version; house rule packs | later |
| 4 | Warbands: build and keep a warband by the rules, experience and injuries | later |
| 5 | Live map: zones over the group's map, battles, weather and effects, live for every viewer; shared-screen display mode | later |
| 6 | Battles, results and consequences: arrange games, players submit results, the CM confirms; CVP, resources, Outposts, Exploration, Glory, Ducats, Hell on Earth, Visions and Omens | later |

**Version 1.0 = steps 1 to 6.** The app ships to other groups only when a CM can run a full game night without
paper. Earlier steps are internal milestones used by the project lead's own group.

**Definition of done for every step**

1. A reviewed visual page exists for the step.
2. Type-check, unit, API and end-to-end tests pass.
3. Every new workflow, endpoint, form action, service and table is in the atlas model, and
   `atlas check --strict` is clean.
4. The docs (README, this file, ARCHITECTURE.md, DESIGN.md) match what was built.

## 10. Requirements for step 1: accounts and sign-in

### 10.1 Functional

| Id | Requirement |
|---|---|
| F1 | One sign-in screen for all roles: username, password and "Remember me". |
| F2 | After sign-in each role lands in its own area: Owner `/owner`, Admin `/admin`, User `/home`. A header switcher shows every area the person can use, since Owners and Admins also play. |
| F3 | Sign-in is limited to 5 tries a minute per username and per IP address, then a short wait. The limit is kept in memory. A wrong password and an unknown username get the same message ("Wrong username or password"). |
| F4 | On first start, while no Owner exists, the app prints a one-time setup link in its logs. The link creates the first Owner and expires after use or after one hour. |
| F5 | Owners invite admins and users; admins invite users; users cannot invite. An invite is a link that fixes the role, is valid for 7 days and works once. |
| F6 | The inviter sees their pending invites and can revoke or re-send them. |
| F7 | Owners see every account. Admins see the users they invited. |
| F8 | Owners change roles. The last Owner can never be demoted or disabled. |
| F9 | Owners disable accounts. A disabled account is signed out everywhere and cannot sign in. Its history stays. |
| F10 | Owners reset a password to a temporary one, which must be changed at the next sign-in. This is the recovery path without email. |
| F11 | A locked-out Owner is recovered with a documented `docker compose exec` command. |
| F12 | Usernames are 3 to 32 characters: letters, digits, dot, dash and underscore. They are unique ignoring case and are used only to sign in. |
| F13 | Every account has a display name: free text, changeable, shown wherever the person appears. |
| F14 | Passwords are 10 to 128 characters, any characters allowed, no composition rules. A short list of common passwords is refused. |
| F15 | Everyone can change their display name and password and sign out of every device. |
| F16 | With "Remember me" a session lasts 30 days and each use extends it. Without it, the session ends when the browser closes. |
| F17 | The app records sign-ins, invites, role changes, disables and password resets in an audit log (who, what, when). The Owner can view it. |
| F18 | The Owner can anonymise a disabled account. Its display name becomes "Former member". |
| F19 | The Owner area offers backup download and restore, and warns when the copy is served over plain HTTP. |
| F20 | A JSON API under `/api/v1/` offers the same actions as the pages, authenticated by the session cookie. Pages and the API call the same services. The API is described by an OpenAPI document at `/api/v1/openapi.json`. |

### 10.2 Non-functional (all steps)

| Id | Area | Requirement |
|---|---|---|
| N1 | Install | Installs with `docker compose up -d`: one app container and one PostgreSQL container; settings in `.env`. |
| N2 | Stack | Uses the newest stable versions of its stack (PostgreSQL 18, Node 26, SvelteKit 3 and so on). |
| N3 | Performance | With 30 concurrent users on a 4-core laptop: pages under 1 s and API calls under 200 ms at the 95th percentile; live updates arrive in under 1 s. Measured with a small load script before each release. |
| N4 | Browsers | The last two versions of Chrome, Edge, Firefox and Safari, at 1366 to 1920 px wide. Smaller screens must not break. |
| N5 | Accessibility | WCAG 2.2 AA for contrast, keyboard use, focus and labels. Every control is reachable by keyboard, focus is visible, forms are labelled, and colour is never the only signal (keyword chips also carry marks). |
| N6 | Passwords and tokens | Passwords hashed with scrypt, with a versioned hash format. Only SHA-256 hashes of session and invite tokens are stored. |
| N7 | Sessions | HttpOnly, SameSite=Lax cookies; Secure over HTTPS. |
| N8 | CSRF | Every state change is protected by origin checks plus SameSite cookies. |
| N9 | Input and errors | Every endpoint and form validates its input. Errors use one shape with a request id; every response carries `X-Request-Id`. |
| N10 | Headers | Security headers and a strict Content Security Policy; no scripts from outside the app. |
| N11 | Dependencies | CI audits dependencies and fails the build on known critical vulnerabilities. |
| N12 | Privacy | Store the minimum: no email, no real names required, no analytics, no telemetry, no tracking. |
| N13 | Retention | Sessions and audit entries older than a set period (180 days by default) are pruned. Disabled accounts keep their history until the Owner anonymises them. |
| N14 | Languages | English only. All interface strings live in one message file from the start, so a translation later means translating a file. |
| N15 | Reliability | When the database is down the app says so clearly and reconnects on its own. Every write runs in a transaction; battle consequences are never partly written. |
| N16 | Upgrades | Migrations are forward-only and run at start after an automatic dump. No campaign data is lost across an update. |
| N17 | Offline | Every asset ships in the image. The app works with no internet connection. |
| N18 | Documentation | Every endpoint, form action, workflow, service and table is documented in the atlas model. |

## 11. Rules fidelity and house rules (steps 3 to 6)

These decisions shape steps 3 to 6. They are listed here so every step builds toward them.

| Topic | Decision |
|---|---|
| **Enforcement** | Players cannot save an illegal warband or result. The CM sees the same checks as warnings and may save anyway with a reason, which is recorded and shown. |
| **CM overrides** | The CM can edit any value with a required note. Every override keeps who, when and why, and is shown to players on the affected item. |
| **House rules** | A campaign selects one base rule pack plus optional house rule packs that change values (costs, limits, keywords). The campaign page lists the active house rules. |
| **Editions and versions** | Packs carry an edition and a version. A campaign pins a pack version. Upgrading is a CM action that first shows a diff of what changes. |
| **Bookkeeping** | The app calculates the consequences of a result and shows them as a list of proposed changes. The CM confirms or edits them before they apply. |

## 12. Terminology

Use the book's words in the interface and the code: Campaign Master (CM), warband, Aggressor and defender,
Entry Zone, Special Zone, Outpost, supply, Exploration, Glory, Ducats, Campaign Victory Points (CVP), Hell on
Earth, Visions, Omens.

Owner, Admin and User are the app's site roles. In the interface an Admin is called a Campaign Master where that
reads better.

**Interface voice.** Buttons, forms and errors use plain words: "Save", "Record result", "Wrong username or
password". Headings, empty states and the map carry the setting's voice in small doses, such as a quiet line on
an empty campaign page.

## 13. Content and copyright

Trench Crusade, its books, rules text, map art and lore belong to Factory Fortress Inc. The app never ships any
of it.

| Topic | Decision |
|---|---|
| **Name use** | The app is called Forgotten Letters. Trench Crusade appears only as a description ("a campaign companion for Trench Crusade"). No official logos, fonts or art. |
| **Notice** | The README and the app footer say the app is unofficial and not affiliated with Factory Fortress. |
| **Rule packs** | The Owner uploads pack files (JSON) in the Owner area. Upload validates them against the published schema and shows errors per line. The project publishes the pack format and an empty example. |
| **Pack content** | Structured data: names, costs, stats, keywords and limits, each with a page reference. Groups may add their own text; it stays in their copy. |
| **Sharing packs** | The project does not host or link packs. The docs say packs are for groups who own the books. |
| **Campaign map** | The Owner uploads the group's map image and draws zones over it. The app ships only a plain placeholder map for demos. |
| **Repository** | `docs/*` (except `docs/superpowers/` and `docs/adr/`), `assets/map/` and `backups/` are git-ignored. A CI check fails if PDFs or pack files are tracked. |
| **Image** | The Docker image is built only from source and the project's own assets. No volume content is baked in. |
| **Own assets** | Blender-made effects and seals (`assets/blender`, `assets/fx`) belong to the project. |

## 14. Success measures

| Measure | How it is checked |
|---|---|
| A new group installs and signs in as Owner in under 10 minutes from the README. | Timed with someone new to the project. |
| A game night where every result is recorded in the app and nobody tracks the campaign on paper. | Observed at a real game night. |
| Recording one battle result takes under 1 minute. | Timed at a real game night. |
| No campaign data is lost across updates during a full campaign. | Tracked through a whole campaign. |
| Every step ships with its checks passing and the atlas model matching the code. | CI and `atlas check --strict`. |
| Players check standings between sessions without being asked. | Observed by the CM. |
| The CM spends game night playing or adjudicating, not typing. | Asked of the CM after each night. |

## 15. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | Copyright takedown if book content leaks into the repository or image. | Ignore rules, a CI check for PDFs and pack files, an image built only from source and own assets. |
| R2 | The rule pack format is too rigid for later editions. | Version the pack schema from the start; packs carry edition and version. |
| R3 | Scope creep repeats the first version. | A reviewed visual page and a definition of done for every step; the out-of-scope list in §8. |
| R4 | Data loss on an update mid-campaign. | Automatic dump before migrations, daily backups kept 14 days, forward-only migrations, a migration test in CI. |
| R5 | Venue Wi-Fi blocks devices from reaching the laptop. | Docs for running over a phone hotspot or a travel router. |
| R6 | Single maintainer (bus factor). | The atlas model and the agents guide keep the system documented. |
| R7 | Players have no laptop at the table while layouts are desktop first. | Pages must not break on a phone; phone layouts are reviewed before step 6. |

## 16. Open questions

| # | Question | Blocks |
|---|---|---|
| Q1 | Should a visitor or a display link show the live map and standings without signing in (a per-campaign switch)? | Step 5 |
| Q2 | What exactly is hidden from other players on the map and in the standings? | Step 5 |
| Q3 | Does version 1 support campaign types beyond the Carcass Front? | Step 2 |
| Q4 | Who writes the first rule pack, and is its schema reviewed with a second group? | Step 3 |
| Q5 | When do phone layouts move from deferred to planned? | Review before step 6 |

Closed: "Which step follows step 1?" Campaigns and seats (step 2), then rules data (step 3).

## Appendix: Decisions

- Pitch: "A self-hosted campaign companion for Trench Crusade, built first for the Carcass Front."
- Trench Crusade is named only descriptively, with an unofficial notice; no official logos, fonts or art.
- Interface copy is plain; the setting's voice appears only in headings, empty states and the map.
- The book's terms are used for game concepts; Owner, Admin and User stay as app roles.
- The CM is the primary audience; players come second.
- Site roles Owner > Admin > User; campaign roles CM, co-CM and player arrive in step 2.
- Any role can hold a seat; CM edits to their own warband are recorded as CM actions.
- Visitors see only the sign-in, setup and invite pages.
- The first Owner is created through a one-time setup link printed in the logs (valid one hour).
- Accounts use username and password, invite links only (7 days, single use, revocable); no email or OAuth.
- Recovery: the Owner resets to a temporary password; a CLI command recovers a locked-out Owner.
- No permanent account delete; disable keeps history; the Owner can anonymise to "Former member".
- Passwords 10 to 128 characters with a common-password block list; usernames 3 to 32 characters, unique ignoring case.
- Sessions last 30 days sliding with "Remember me", browser session without.
- Sign-in limited to 5 tries a minute per username and per IP, in memory.
- Account actions go to an audit log the Owner can view.
- A JSON API at `/api/v1/` mirrors the pages.
- Players submit results; the CM confirms; consequences apply on confirmation.
- Live push (Server-Sent Events) for the map, trackers and result queue from step 5.
- Shared-screen display mode is built with the live map in step 5.
- Hosting: Docker Compose, one app and one PostgreSQL; optional Caddy profile for HTTPS.
- Works fully offline on a LAN; no analytics or telemetry.
- Updates: pull a new image; an automatic dump runs before migrations.
- Daily backups kept 14 days; the Owner can download or restore one.
- Version 1.0 is steps 1 to 6, released when a CM can run a night without paper.
- Rules: block for players, warn for the CM; CM overrides need a note and keep history.
- House rules are packs layered on a base pack per campaign; campaigns pin a pack version.
- The app proposes consequences; the CM confirms or edits before they apply.
- Rule packs and the map are uploaded by the Owner; the project ships neither and does not host packs.
- Licence: AGPL-3.0.
