# Grimdark Design Lab + Repo Hygiene — Design Spec

Date: 2026-07-04
Status: Approved direction (pending spec review)
Branch base: `main`

## 1. Overview

Two coordinated efforts, planned together and executed one step at a time:

1. **Design Lab** — a standalone Vite + React sandbox (`design-lab/`) that ports the
   grimdark "Forgotten Letters" Profile design (blood-red / tarnished-gold / Cinzel)
   into real, reusable components, adds a tasteful anime.js motion layer and one or two
   ReactBits-inspired touches, and ships two routes: a faithful **Profile** page and a
   new **Design System** showcase page.
2. **Repo Hygiene** — bring the messy working tree under control: commit the real project
   files, gitignore the unrelated agent tooling, and commit three chosen skills
   (graphify, impeccable, design-sync) as intentional repo tooling.

`TODO.md`'s eight product phases remain the long-term roadmap and are **not** executed
here; the Design Lab is added to `TODO.md` as its own tracked section.

### Decisions (locked)

- Visual direction: **grimdark blood/gold/Cinzel** is canon; the steel-blue "War Room"
  system is superseded going forward.
- New app shape: **standalone Vite + React** sandbox under `design-lab/` (does not touch
  the Next.js app).
- Motion: **faithful port + restrained motion** (anime.js) + 1–2 ReactBits-inspired touches.
- Skills to commit: **graphify, impeccable, design-sync**.
- Unrelated tooling: **gitignore** (keep local, reversible) — not deleted from disk.
- Immediate scope: **design-lab + repo hygiene now**; product phases stay as roadmap.

## 2. Non-Goals

- Not executing TODO.md product phases (auth, DB schema, map editor, etc.).
- Not retokening the real Next.js app or `src/components/ui` yet (that is a documented
  follow-up once the grimdark direction is validated in the lab).
- Not deleting any files from disk (gitignore only).
- Not re-syncing the Claude Design system in this effort (separate follow-up).

## 3. Design Lab architecture

### 3.1 Stack and structure

Vite + React + TypeScript, isolated under `design-lab/` with its own `package.json`,
lockfile, and `node_modules`. Routing via `react-router-dom`. Motion via `animejs`.
Fonts (Cinzel / Inter / JetBrains Mono) via Google Fonts.

```text
design-lab/
  index.html
  package.json            # vite, react, react-dom, react-router-dom, animejs, TS
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx               # router + nav/footer chrome
    tokens/
      colors.ts           # FL palette as typed constants
      theme.css           # CSS custom properties + base + grain/scrollbar utils
    lib/
      useInView.ts        # IntersectionObserver hook
      motion.ts           # anime.js helpers: reveal(), countUp(), barFill()
    components/
      primitives/         # Button, Pill, BadgeChip, Section, Card, RecordCell,
                          # MetricCell, StatBar, Timeline, MatchRow, WarbandRow,
                          # ActiveCampaignRow
      art/                # FighterMini, SigilNA, DucatIcon, GloryIcon, HeartIcon, Icons
      chrome/             # Navbar, Footer (ported from canvas Chrome.jsx)
    pages/
      ProfilePage.tsx
      DesignSystemPage.tsx
    data/
      profile.ts          # typed mock data extracted from the design
```

Each primitive is a single-purpose module with an explicit prop contract, so it can be
graded in the Design System page in isolation and later ported to the real app.

### 3.2 Design tokens

Port `components/tokens.jsx` from the design project into `tokens/`:

- Colors: `bg #0C0C0E`, `surface #1A1A1F`, `elevated #252529`, `border #2E2E35`,
  `borderHi #3A3A42`, `text #E8E2D6`, `text2 #9B9484`, `textMuted #5C574E`,
  `blood #8B1A1A`, `crimson #A52222`, `gold #B8923F`, `brass #8A6D2F`,
  `success #2D6B4F`, `warn #B8860B`, `danger #C0392B`, `info #4A6FA5`.
- Type: display `Cinzel`, body `Inter`, mono `JetBrains Mono`.
- Utilities: grain overlay (SVG turbulence), custom scrollbar, focus ring, pulse/flicker
  keyframes — all as CSS in `theme.css`, exposed as CSS variables plus a typed `FL` object.

### 3.3 Pages

- **`/profile`** — faithful port of the Varius Castellan public profile: hero (framed
  avatar, identity, badges, follow/stats), page tabs, then the 3-column body — left
  (career W/D/L, favorite faction, field record, connections), center (created warbands,
  match history table with fighter mini-portraits, active campaigns, authored scenarios),
  right (activity timeline, campaign history, achievements grid). Footer.
- **`/design-system`** — the new design-system reference: color swatches for every token,
  the type scale in all three families, and a live gallery of every primitive with its
  variants (buttons, pills, badges, cards, stat cells, W/D/L bars, timeline, rows, SVG art).

### 3.4 Motion (anime.js) + ReactBits touches

- `motion.ts`: `reveal()` (staggered fade/translate section entrances on in-view),
  `countUp()` (followers 284, win-rate 63%, ducats 42,180), `barFill()` (W/D/L stacked
  bar and faction bars animate width from 0), streak-cell pop-in, card hover-lift.
- ReactBits-inspired, restrained: an animated hero backdrop (drifting gold trench pattern
  - ember/grain over the blood gradient) and a split-text reveal on the hero name.
- All motion gated behind `prefers-reduced-motion: reduce` (no-op when set).

### 3.5 Verification

- `npm run dev` in `design-lab/` serves both routes with no console errors.
- `npm run build` succeeds.
- Visual check of both pages (screenshots) against the source design; motion runs and
  respects reduced-motion.

## 4. Repo hygiene

### 4.1 Classification

- **Commit (real project):** `README.md` (mod), `TODO.md` (mod), `.devcontainer/`,
  `.env.example`, `.github/workflows` + `scripts` + `hooks` + `plans` (CI/project, not
  the mirrored `skills/`), `.gitmessage`, `CLAUDE.md`, `docs/` (incl. `Techstack.md`),
  `public/`, `sanity/`, `supabase/`, and the new `design-lab/`.
- **Commit (chosen skills):** graphify, impeccable, design-sync — see §5.
- **Gitignore (unrelated tooling, keep local):** `skills-lock.json`, mirrored `.agents/`,
  `.claude/` (harness state incl. `settings.local.json`), `agent/`, `.github/skills/`,
  `.codex/`, generated `graphify-out/`, and everything under `skills/` **except** the three
  keepers (see §5). Already ignored: `.ds-sync/`, `ds-bundle/`, `.design-sync/.cache`,
  `.design-sync/node_modules`.

Mechanism for `skills/`: ignore broadly then negate the keepers, so the other 30 stay local:

```gitignore
skills/*
!skills/graphify/
!skills/impeccable/
!skills/design-sync/
```

Note on `.claude/`: it holds harness `settings.json` / `settings.local.json` / `CLAUDE.md`
and the transient `skills/`. Default is to ignore all of `.claude/` (harness state) — the
three keeper skills live in the committed `skills/` dir instead (§5), and the root
`CLAUDE.md` is already tracked separately. If the plan finds `.claude/settings.json` worth
sharing, it may add a single `!.claude/settings.json` negation; `settings.local.json` stays
ignored regardless.

### 4.2 Approach

Add precise `.gitignore` entries for the unrelated tooling, then stage and commit the
real project files in logically grouped commits (conventional-commits style). Nothing is
deleted from disk. Work on a dedicated branch off `main`.

## 5. Skill commit

graphify, impeccable, and design-sync are the three skills to keep as intentional repo
tooling. Canonical committed location: the repo's own `skills/` directory, using the
negated-ignore mechanism in §4.1 (`skills/*` + `!skills/graphify/` etc.), so exactly these
three are versioned and the other 30 stay local.

Plan steps:

- Ensure a copy of each keeper exists at `skills/<name>/` (graphify and impeccable are
  currently under `.claude/skills/`; design-sync is a bundled harness skill — copy each in).
- Apply the negated-ignore entries, then `git add` the three dirs and commit.
- Update `CLAUDE.md` / `.claude/CLAUDE.md` references so any `.claude/skills/<name>/SKILL.md`
  path points at the committed `skills/<name>/SKILL.md` copy (the graphify project rule
  already references `.claude/skills/graphify/SKILL.md`; reconcile it to the committed path).

Intent: these three are versioned repo tooling; the rest are not.

## 6. TODO.md integration

Add a new top section to `TODO.md` — "Design Lab (grimdark redesign)" — with the checklist
derived from §3 and §7, placed above the product phases and marked as the current active
work. The eight product phases remain unchanged as the standing roadmap. Also add a short
"Repo hygiene" checklist reflecting §4–§5.

## 7. Execution order (one step at a time)

1. Branch off `main` for the whole effort (e.g. `chore/repo-hygiene-and-design-lab`), or
   split into two branches (hygiene, design-lab) — decided in the plan.
2. Repo hygiene: write `.gitignore` entries → commit real project files in grouped commits.
3. Skill commit: place graphify / impeccable / design-sync in their canonical location and
   commit.
4. Design Lab scaffold: Vite app, tokens, chrome, routing — verify dev server boots.
5. Primitives + art + data modules — verify in isolation via the Design System page.
6. Profile page port — verify against source design.
7. Motion layer + ReactBits touches — verify with reduced-motion respected.
8. TODO.md updates + final commits + PR(s).

## 8. Risks and open questions

- **Skill canonical location** (§5) has two viable mechanisms; the plan picks one. Low risk.
- **`.claude/settings.json`** — commit project settings vs. ignore all of `.claude/` except
  chosen skills. The plan will make this explicit; default is to ignore harness state and
  only commit the three skills + existing tracked config.
- **Font licensing** — Cinzel, Inter, JetBrains Mono are all SIL OFL; loaded via Google
  Fonts in the lab. No issue.
- **Porting back to the real app** is explicitly out of scope here and tracked as a
  follow-up once the lab validates the direction.
