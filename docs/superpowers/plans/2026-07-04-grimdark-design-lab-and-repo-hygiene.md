# Grimdark Design Lab + Repo Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the repo working tree under version control (commit real files, gitignore unrelated agent tooling, commit three chosen skills) and build a standalone grimdark `design-lab/` sandbox (Vite + React) with a faithful Profile page, a Design System showcase page, and a restrained anime.js motion layer.

**Architecture:** Three sequential groups on one effort branch (`chore/repo-hygiene-and-design-lab`). Group A/B are git-only (no build). Group C is an isolated Vite app under `design-lab/` with its own `package.json`/`node_modules` — it never imports from or touches the Next.js app. Ports are adapted from the Claude Design project `019deab1-6615-7da8-a573-01f2a2c41b12` (files re-fetchable via the DesignSync tool `get_file`).

**Tech Stack:** git, Vite 5, React 18, TypeScript, react-router-dom 6, animejs 3, Google Fonts (Cinzel/Inter/JetBrains Mono).

## Global Constraints

- Nothing is deleted from disk in this plan — unrelated tooling is gitignore-only.
- `design-lab/` is fully isolated: no imports to/from `src/`, no shared `package.json`.
- Grimdark palette is canon (exact hex in Task C2). Never substitute steel-blue tokens.
- All motion must no-op under `@media (prefers-reduced-motion: reduce)`.
- Fonts: Cinzel (display), Inter (body), JetBrains Mono (mono) — all SIL OFL, via Google Fonts.
- Commit style: Conventional Commits; every commit body ends with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Branch: `chore/repo-hygiene-and-design-lab` (already created; spec already committed there).

---

## Group A — Repo hygiene

### Task A1: Gitignore unrelated agent tooling, keep three skills

**Files:**
- Modify: `.gitignore` (append a new section)

**Interfaces:**
- Produces: an ignore state where `git status --porcelain` no longer lists `.agents/`,
  `agent/`, `.codex/`, `.claude/`, `graphify-out/`, `skills-lock.json`, `.github/skills/`,
  or any `skills/*` dir except `skills/graphify/`, `skills/impeccable/`, `skills/design-sync/`.

- [ ] **Step 1: Append ignore rules to `.gitignore`**

Append this block verbatim:

```gitignore

# ── Agent tooling (kept local, not committed) ───────────────
.agents/
agent/
.codex/
.claude/
graphify-out/
skills-lock.json
.github/skills/

# Installed skills: ignore all except the three committed keepers
skills/*
!skills/graphify/
!skills/impeccable/
!skills/design-sync/
```

- [ ] **Step 2: Verify the ignore result**

Run: `git status --porcelain | grep -E '^\?\? (\.agents|agent|\.codex|\.claude|graphify-out|skills-lock|\.github/skills)' ; echo "exit=$?"`
Expected: no matching lines (grep exit=1). The listed paths are now ignored.

- [ ] **Step 3: Verify keepers are NOT ignored**

Run: `git check-ignore skills/graphify skills/impeccable skills/design-sync ; echo "exit=$?"`
Expected: no output, exit=1 (none are ignored). Note: these dirs may not exist yet — Task B1 creates them; this step only confirms the negations are effective once present. If the dirs don't exist yet, this returns exit=1 as well, which is acceptable.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): ignore unrelated agent tooling, keep 3 skills

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task A2: Commit the real project files

**Files:**
- Add (already on disk, untracked): `.devcontainer/`, `.env.example`, `.gitmessage`,
  `CLAUDE.md`, `.github/` (workflows/scripts/hooks/plans — NOT `.github/skills/`, now ignored),
  `docs/` (incl. `Techstack.md`, the new `superpowers/`), `public/`, `sanity/`, `supabase/`
- Modify: `README.md`, `TODO.md` (already modified in working tree; TODO.md gets further edits in Task D1)

**Interfaces:**
- Produces: a clean `git status` where only intended files remain (design-lab appears later).

- [ ] **Step 1: Stage the real project files**

```bash
git add .devcontainer .env.example .gitmessage CLAUDE.md .github docs public sanity supabase README.md
```

- [ ] **Step 2: Verify nothing unrelated is staged**

Run: `git diff --cached --name-only | grep -E '(^|/)(\.claude|\.agents|\.codex|graphify-out|skills-lock|\.github/skills)/' ; echo "exit=$?"`
Expected: no matches (exit=1). If any appear, unstage them and re-check Task A1's ignores.

- [ ] **Step 3: Commit project scaffolding + infra**

```bash
git commit -m "chore(repo): commit project scaffolding, infra, and docs

Devcontainer, CI workflows/scripts/hooks, Sanity + Supabase config,
public assets, env example, and docs (incl. superpowers specs).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Verify working tree**

Run: `git status --short`
Expected: only `TODO.md` (still modified, edited in Task D1) and untracked `skills/graphify`, `skills/impeccable`, `skills/design-sync` (created in Task B1) plus (later) `design-lab/`. No stray agent-tooling paths.

---

## Group B — Commit chosen skills

### Task B1: Place and commit graphify, impeccable, design-sync

**Files:**
- Create: `skills/graphify/` (copy of the installed skill)
- Create: `skills/impeccable/` (copy of the installed skill)
- Create: `skills/design-sync/` (copy of the bundled skill)
- Modify: `.claude/CLAUDE.md` reference reconciliation is N/A (`.claude/` is ignored); instead ensure root `CLAUDE.md` / `.claude/CLAUDE.md` on-disk references still resolve — see Step 3.

**Interfaces:**
- Produces: three committed skill directories under `skills/`, each containing at least
  `SKILL.md`.

- [ ] **Step 1: Locate the source skill directories**

Run:
```bash
ls -d .claude/skills/graphify .agents/skills/graphify ~/.claude/skills/graphify 2>/dev/null | head -1
ls -d .claude/skills/impeccable .agents/skills/impeccable .github/skills/impeccable 2>/dev/null | head -1
ls -d /tmp/claude-1000/bundled-skills/*/*/design-sync 2>/dev/null | head -1
```
Expected: one existing source path per skill. Record each.

- [ ] **Step 2: Copy each skill into `skills/`**

```bash
mkdir -p skills
cp -R "<graphify-src>"   skills/graphify
cp -R "<impeccable-src>" skills/impeccable
cp -R "<design-sync-src>" skills/design-sync
ls skills/graphify/SKILL.md skills/impeccable/SKILL.md skills/design-sync/SKILL.md
```
Expected: all three `SKILL.md` files exist.

- [ ] **Step 3: Reconcile CLAUDE.md references (if needed)**

Run: `grep -rn "\.claude/skills/graphify\|~/.claude/skills/graphify" CLAUDE.md .claude/CLAUDE.md 2>/dev/null`
If matches exist, add a committed pointer note in root `CLAUDE.md` that the canonical
committed copies live in `skills/<name>/` (the `.claude/` copies remain for the live
harness but are gitignored). Keep edits minimal — one clarifying line under the graphify
section. Do not break the existing live-harness paths.

- [ ] **Step 4: Verify the keepers stage despite the broad ignore**

Run: `git add skills/graphify skills/impeccable skills/design-sync && git status --porcelain skills | head`
Expected: the three dirs' files are staged (status `A`). If nothing stages, the negations
in Task A1 are wrong — fix `.gitignore` before continuing.

- [ ] **Step 5: Commit**

```bash
git add skills/graphify skills/impeccable skills/design-sync CLAUDE.md
git commit -m "chore(skills): commit graphify, impeccable, design-sync as repo tooling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Group C — Design Lab (Vite + React)

### Task C1: Scaffold the isolated Vite app + routing

**Files:**
- Create: `design-lab/package.json`, `design-lab/vite.config.ts`, `design-lab/tsconfig.json`,
  `design-lab/tsconfig.node.json`, `design-lab/index.html`, `design-lab/.gitignore`,
  `design-lab/src/main.tsx`, `design-lab/src/App.tsx`

**Interfaces:**
- Produces: a bootable Vite app with two routes (`/profile`, `/design-system`) rendering
  placeholders; `App.tsx` exports the router. Nav/footer added in Task C4.

- [ ] **Step 1: Create `design-lab/package.json`**

```json
{
  "name": "forgotten-letters-design-lab",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "animejs": "^3.2.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/animejs": "^3.1.12",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

- [ ] **Step 2: Create config files**

`design-lab/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
```

`design-lab/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`design-lab/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

`design-lab/.gitignore`:
```gitignore
node_modules
dist
*.local
```

- [ ] **Step 3: Create `design-lab/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Forgotten Letters — Design Lab</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `design-lab/src/main.tsx` and `App.tsx`**

`design-lab/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./tokens/theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`design-lab/src/App.tsx` (placeholder routes; nav/footer wired in C4):
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/profile" replace />} />
        <Route path="/profile" element={<div className="fl">Profile (todo)</div>} />
        <Route path="/design-system" element={<div className="fl">Design System (todo)</div>} />
      </Routes>
    </BrowserRouter>
  );
}
```

Note: `./tokens/theme.css` is created in Task C2; until then `main.tsx` import will fail the
build. Do C1 and C2 together before the first verify, or temporarily comment the import.

- [ ] **Step 5: Install and boot**

```bash
cd design-lab && npm install && npm run build
```
Expected: `npm install` succeeds; `npm run build` fails only on the missing `theme.css`
import (resolved in C2) — otherwise clean. Do not commit yet; commit at end of C2.

### Task C2: Design tokens (colors.ts + theme.css)

**Files:**
- Create: `design-lab/src/tokens/colors.ts`, `design-lab/src/tokens/theme.css`

**Interfaces:**
- Produces: `export const FL` (typed color+font object) from `colors.ts`; global CSS with
  `--fl-*` custom properties, `.fl` base class, `.fl-display`/`.fl-mono` font classes, grain,
  scrollbar, focus, and `fl-pulse`/`fl-flicker` keyframes.

- [ ] **Step 1: Create `colors.ts`** (exact hex from the design project `tokens.jsx`)

```ts
export const FL = {
  bg: "#0C0C0E",
  surface: "#1A1A1F",
  elevated: "#252529",
  border: "#2E2E35",
  borderHi: "#3A3A42",
  text: "#E8E2D6",
  text2: "#9B9484",
  textMuted: "#5C574E",
  blood: "#8B1A1A",
  crimson: "#A52222",
  gold: "#B8923F",
  brass: "#8A6D2F",
  success: "#2D6B4F",
  warn: "#B8860B",
  danger: "#C0392B",
  info: "#4A6FA5",
  display: '"Cinzel", Georgia, serif',
  body: '"Inter", -apple-system, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

export type FLColor = keyof typeof FL;
```

- [ ] **Step 2: Create `theme.css`** (port the `<style id="fl-base">` block from `tokens.jsx` to plain CSS, add `:root` variables and a dark page background)

```css
:root {
  --fl-bg: #0C0C0E; --fl-surface: #1A1A1F; --fl-elevated: #252529;
  --fl-border: #2E2E35; --fl-border-hi: #3A3A42;
  --fl-text: #E8E2D6; --fl-text2: #9B9484; --fl-text-muted: #5C574E;
  --fl-blood: #8B1A1A; --fl-crimson: #A52222; --fl-gold: #B8923F; --fl-brass: #8A6D2F;
  --fl-success: #2D6B4F; --fl-warn: #B8860B; --fl-danger: #C0392B; --fl-info: #4A6FA5;
  --fl-display: "Cinzel", Georgia, serif;
  --fl-body: "Inter", -apple-system, sans-serif;
  --fl-mono: "JetBrains Mono", ui-monospace, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--fl-bg); }
.fl, .fl * { box-sizing: border-box; }
.fl { font-family: var(--fl-body); color: var(--fl-text); -webkit-font-smoothing: antialiased; background: var(--fl-bg); }
.fl-display { font-family: var(--fl-display); letter-spacing: 0.02em; }
.fl-mono { font-family: var(--fl-mono); }
.fl input, .fl button, .fl textarea { font-family: inherit; }
.fl button { cursor: pointer; }
.fl ::selection { background: var(--fl-blood); color: var(--fl-text); }
.fl-grain {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.04;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.fl-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.fl-scroll::-webkit-scrollbar-track { background: var(--fl-bg); }
.fl-scroll::-webkit-scrollbar-thumb { background: var(--fl-border); border-radius: 4px; }
.fl-focus:focus-visible { outline: 2px solid var(--fl-blood); outline-offset: 2px; }
@keyframes fl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes fl-flicker { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 3: Boot and visually verify tokens**

Run: `cd design-lab && npm run build`
Expected: build succeeds (no missing-import error).
Then `npm run dev`, open `/profile` — page background is charcoal `#0C0C0E`, placeholder
text is bone-white. (Screenshot to confirm during execution.)

- [ ] **Step 4: Commit the scaffold + tokens**

```bash
git add design-lab
git commit -m "feat(design-lab): scaffold Vite app + grimdark tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C3: SVG art + icon set

**Files:**
- Create: `design-lab/src/components/art/icons.tsx` (the `I` icon set from `tokens.jsx`, typed)
- Create: `design-lab/src/components/art/FighterMini.tsx` (archetype portraits from `Profile.jsx`)
- Create: `design-lab/src/components/art/Sigils.tsx` (`SigilNA`, `DucatIcon`, `GloryIcon`, `HeartIcon`)

**Interfaces:**
- Produces: `Icons` (object of `(props?: {size?: number; color?: string}) => JSX.Element`),
  `FighterMini({ arch, size, frame })`, `SigilNA({ size, c })`, `DucatIcon`, `GloryIcon`,
  `HeartIcon({ size, filled })`.

- [ ] **Step 1: Re-fetch the source art** from the design project (DesignSync `get_file` on
  `019deab1-...`, paths `components/tokens.jsx` and `components/Profile.jsx`) — these are the
  authoritative SVG definitions.

- [ ] **Step 2: Port `icons.tsx`** — convert the `I = {...}` object to a typed export `Icons`,
  replacing `p={}` params with `(p: {size?: number; color?: string} = {})`. Keep every path
  verbatim. Default color `currentColor`.

- [ ] **Step 3: Port `FighterMini.tsx`** — copy the `FighterMini` function verbatim, typing
  props `{ arch?: string; size?: number; frame?: "gold" | "border" }`; replace `FL.*` refs
  with imports from `../../tokens/colors`.

- [ ] **Step 4: Port `Sigils.tsx`** — copy `SigilNA`, `DucatIcon`, `GloryIcon`, `HeartIcon`
  verbatim with typed props; import `FL` from `../../tokens/colors`.

- [ ] **Step 5: Verify compile**

Run: `cd design-lab && npm run build`
Expected: build succeeds. (These are rendered in the Design System page in C5.)

- [ ] **Step 6: Commit**

```bash
git add design-lab/src/components/art
git commit -m "feat(design-lab): port SVG art + icon set

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C4: Primitives + chrome

**Files:**
- Create: `design-lab/src/components/primitives/` — `Button.tsx`, `Pill.tsx`, `BadgeChip.tsx`,
  `Section.tsx`, `RecordCell.tsx`, `MetricCell.tsx`, `StatBar.tsx`
- Create: `design-lab/src/components/chrome/Navbar.tsx`, `Footer.tsx`
- Modify: `design-lab/src/App.tsx` (wrap routes with `Navbar`/`Footer`)

**Interfaces:**
- Produces: typed primitives. Exact signatures:
  - `Button({ variant?: "primary"|"secondary"|"gold"|"ghost"; children; onClick? })`
  - `Pill({ tone?: "default"|"gold"|"blood"|"success"|"warn"|"info"; children })`
  - `BadgeChip({ icon: string; label: string; sub?: string; tone?: "gold" })`
  - `Section({ title: string; kicker?: string; cta?: string; children })`
  - `RecordCell({ label: string; v: number; c: string })`
  - `MetricCell({ icon?: ReactNode; v: string; l: string; tone?: string })`
  - `StatBar({ segments: { pct: number; color: string }[] })`

- [ ] **Step 1: Port `Pill`, `Section`, `BadgeChip`, `RecordCell`, `MetricCell`** verbatim
  from the helper functions at the bottom of `Profile.jsx`, converting inline `FL.*` to
  imports and adding the prop types above. One file each.

- [ ] **Step 2: Create `Button.tsx`** from the `btn` style object in `Profile.jsx` (variants
  `p`→primary, `s`→secondary, `gold`, `ghost`):

```tsx
import { FL } from "../../tokens/colors";
type Variant = "primary" | "secondary" | "gold" | "ghost";
const styles: Record<Variant, React.CSSProperties> = {
  primary: { padding: "0 14px", height: 34, background: FL.blood, border: `1px solid ${FL.blood}`, borderRadius: 4, color: FL.text, fontSize: 12, fontWeight: 500, letterSpacing: "0.04em" },
  secondary: { padding: "0 14px", height: 34, background: "transparent", border: `1px solid ${FL.borderHi}`, borderRadius: 4, color: FL.text, fontSize: 12, fontWeight: 500 },
  gold: { padding: "0 14px", height: 34, background: "transparent", border: `1px solid ${FL.brass}`, borderRadius: 4, color: FL.gold, fontSize: 12, fontWeight: 500 },
  ghost: { padding: "0 10px", height: 30, background: "transparent", border: "none", color: FL.text2, fontSize: 12 },
};
export function Button({ variant = "primary", children, onClick }: { variant?: Variant; children: React.ReactNode; onClick?: () => void }) {
  return <button className="fl-focus" style={styles[variant]} onClick={onClick}>{children}</button>;
}
```

- [ ] **Step 3: Create `StatBar.tsx`** (the W/D/L / faction stacked bar, animation-ready via
  a `data-fl-bar` attribute the motion layer targets in C7):

```tsx
export function StatBar({ segments, height = 10 }: { segments: { pct: number; color: string }[]; height?: number }) {
  return (
    <div style={{ display: "flex", height, borderRadius: 2, overflow: "hidden", border: "1px solid var(--fl-border)" }}>
      {segments.map((s, i) => (
        <div key={i} data-fl-bar style={{ width: `${s.pct}%`, background: s.color }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Port `Navbar` + `Footer`** — re-fetch `components/Chrome.jsx` from the design
  project (DesignSync `get_file`), port the `Navbar` (with `variant`/`active` props) and
  `Footer` to TSX with `FL` imports. If `Chrome.jsx` is large, port the logged-in Navbar and
  a minimal Footer faithfully; record any omitted variants in a `design-lab/NOTES.md` line.

- [ ] **Step 5: Wire chrome into `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/chrome/Navbar";
import { Footer } from "./components/chrome/Footer";
import { ProfilePage } from "./pages/ProfilePage";
import { DesignSystemPage } from "./pages/DesignSystemPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="fl">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/design-system" element={<DesignSystemPage />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
```

Note: `ProfilePage`/`DesignSystemPage` imports resolve in C5/C6; keep temporary placeholder
files exporting empty components if building C4 in isolation.

- [ ] **Step 6: Verify + commit**

Run: `cd design-lab && npm run build` → succeeds.
```bash
git add design-lab/src/components design-lab/src/App.tsx
git commit -m "feat(design-lab): primitives + nav/footer chrome

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C5: Mock data + Design System showcase page

**Files:**
- Create: `design-lab/src/data/profile.ts` (typed mock data extracted from `Profile.jsx`)
- Create: `design-lab/src/pages/DesignSystemPage.tsx`

**Interfaces:**
- Consumes: `FL` (C2), all primitives + art (C3/C4).
- Produces: `profileData` (typed export used by C6); `DesignSystemPage` component.

- [ ] **Step 1: Create `data/profile.ts`** — extract the arrays literal-in-JSX from
  `Profile.jsx` (warbands, match history, campaigns, activity, achievements, faction
  distribution, career W/D/L) into typed exports. Example shape:

```ts
export interface MatchRow { r: "W" | "D" | "L"; my: string; myArch: string; myTone: string; op: string; opU: string; opArch: string; sc: string; scenario: string; date: string; feat: boolean; }
export const matches: MatchRow[] = [ /* copy the 7 rows from Profile.jsx */ ];
export const career = { winRate: 63, played: 38, wins: 24, draws: 5, losses: 9, last10: ["W","W","D","W","L","W","W","W","L","W"] as const, streak: "W3", best: "W7" };
// …warbands, campaigns, activity, achievements, factionDist, connections, identity
```

- [ ] **Step 2: Create `DesignSystemPage.tsx`** — a showcase rendering: a color-swatch grid
  for every `FL` color (name + hex chip), the type scale (Cinzel/Inter/JetBrains at display/
  heading/body/mono sizes), and a gallery section per primitive (Button all variants, Pill all
  tones, BadgeChip, StatBar, RecordCell, MetricCell, FighterMini all archetypes, SigilNA,
  icons grid). Each group wrapped in the ported `Section`.

- [ ] **Step 3: Verify visually**

Run: `cd design-lab && npm run dev`, open `/design-system`.
Expected: swatches show correct colors; every primitive renders on the dark field; no console
errors. Screenshot to confirm.

- [ ] **Step 4: Commit**

```bash
git add design-lab/src/data design-lab/src/pages/DesignSystemPage.tsx
git commit -m "feat(design-lab): mock data + design-system showcase page

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C6: Profile page (faithful port)

**Files:**
- Create: `design-lab/src/pages/ProfilePage.tsx`
- Create: `design-lab/src/components/primitives/MatchRow.tsx`, `WarbandRow.tsx`,
  `ActiveCampaignRow.tsx`, `Timeline.tsx` (the row/section sub-components from `Profile.jsx`)

**Interfaces:**
- Consumes: primitives, art, `profileData`.
- Produces: `ProfilePage` — the full 3-column profile matching the design.

- [ ] **Step 1: Port the row sub-components** (`ProfileWarbandRow`, `MatchRow`,
  `ActiveCampaignRow`) verbatim from `Profile.jsx` into typed primitive files, `FL` imported,
  data via props. Extract the right-column activity list into a `Timeline` component.

- [ ] **Step 2: Port `ProfilePage.tsx`** — reproduce the full layout from `Profile.jsx`:
  hero header (framed avatar SVG, identity block, badges row, actions + follower/following
  stats), page tabs, then the `320px 1fr 320px` grid — left aside (career W/D/L using `StatBar`
  + `RecordCell`, favorite faction with `SigilNA` + faction bars, field record `MetricCell`
  grid, connections), center main (warbands grid, match-history table, active campaigns,
  authored scenarios), right aside (activity `Timeline`, campaign history, achievements grid).
  All literal data comes from `data/profile.ts`. Replace every `window.FL`/`FL.*` with the
  imported `FL`; replace `Navbar`/`Footer` (already in `App.tsx`) — the page renders only the
  inner content (do not double-render chrome).

- [ ] **Step 3: Verify against source**

Run: `cd design-lab && npm run dev`, open `/profile`.
Expected: layout matches the design project's Profile artboard (hero, 3 columns, all
sections present, blood/gold/Cinzel styling). Screenshot and compare to the source design.
Fix spacing/color drift.

- [ ] **Step 4: Commit**

```bash
git add design-lab/src/pages/ProfilePage.tsx design-lab/src/components/primitives
git commit -m "feat(design-lab): faithful grimdark Profile page port

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task C7: Motion layer + ReactBits touches

**Files:**
- Create: `design-lab/src/lib/useInView.ts`, `design-lab/src/lib/motion.ts`,
  `design-lab/src/components/art/HeroBackdrop.tsx`
- Modify: `ProfilePage.tsx` (attach reveal refs, count-up targets, hero backdrop, split-text name)

**Interfaces:**
- Consumes: `animejs`.
- Produces: `useInView(ref, cb, opts?)`; `reveal(el, opts?)`, `countUp(el, to, opts?)`,
  `barFill(container)`; `HeroBackdrop` component.

- [ ] **Step 1: `useInView.ts`** — IntersectionObserver hook that fires once when the element
  enters view; respects `prefers-reduced-motion` by firing immediately (no animation).

```ts
import { useEffect, useRef } from "react";
export function useInView<T extends HTMLElement>(onEnter: (el: T) => void, opts?: IntersectionObserverInit) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { onEnter(el); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { onEnter(el); io.unobserve(el); }
    }, opts ?? { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
```

- [ ] **Step 2: `motion.ts`** — anime.js helpers, all guarded by reduced-motion:

```ts
import anime from "animejs";
const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export function reveal(targets: anime.AnimeTarget) {
  if (reduce()) return;
  anime({ targets, opacity: [0, 1], translateY: [16, 0], duration: 600, delay: anime.stagger(70), easing: "easeOutQuart" });
}
export function countUp(el: HTMLElement, to: number, suffix = "") {
  if (reduce()) { el.textContent = `${to}${suffix}`; return; }
  const obj = { v: 0 };
  anime({ targets: obj, v: to, duration: 1200, easing: "easeOutExpo", round: 1, update: () => { el.textContent = `${Math.round(obj.v)}${suffix}`; } });
}
export function barFill(container: HTMLElement) {
  if (reduce()) return;
  const bars = container.querySelectorAll<HTMLElement>("[data-fl-bar]");
  bars.forEach((b) => { const w = b.style.width; b.style.width = "0%"; anime({ targets: b, width: w, duration: 900, easing: "easeOutQuart" }); });
}
```

- [ ] **Step 3: `HeroBackdrop.tsx`** — the ReactBits-inspired touch: a positioned layer over
  the hero blood gradient with the grain (`fl-grain`) plus a slow anime.js drift on the gold
  trench-pattern SVG (translateX loop, ~24s, `direction: "alternate"`), disabled under
  reduced-motion. Keep opacity low (≤0.08).

- [ ] **Step 4: Wire into `ProfilePage.tsx`** — use `useInView` on each major `Section` to call
  `reveal` on its children; put `countUp` on the follower (284), win-rate (63, suffix "%"), and
  ducats (42180) numbers; call `barFill` on the career + faction bar containers when in view;
  render `HeroBackdrop` in the hero; wrap the hero name in per-letter spans and stagger-reveal
  them (split-text).

- [ ] **Step 5: Verify motion + reduced-motion**

Run: `cd design-lab && npm run dev`, open `/profile`: sections fade/rise in on scroll, numbers
count up, bars fill. Then set OS/browser reduced-motion (or DevTools "Emulate
prefers-reduced-motion") and reload: content appears fully, no animation, numbers show final
values. Screenshot both.

- [ ] **Step 6: Build + commit**

```bash
cd design-lab && npm run build   # succeeds
git add design-lab/src/lib design-lab/src/components/art/HeroBackdrop.tsx design-lab/src/pages/ProfilePage.tsx
git commit -m "feat(design-lab): anime.js motion layer + hero backdrop

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Group D — TODO integration + finalize

### Task D1: Update TODO.md and open PR

**Files:**
- Modify: `TODO.md` (prepend a Design Lab section + a Repo Hygiene section, above Phase 0)
- Create: `design-lab/README.md` (how to run the lab)

**Interfaces:**
- Produces: updated roadmap; a PR for the whole effort.

- [ ] **Step 1: Prepend to `TODO.md`** a new section before `## Phase 0`:

```markdown
## Design Lab (grimdark redesign) — ACTIVE

- [x] Repo hygiene: gitignore unrelated tooling, commit real project files
- [x] Commit graphify / impeccable / design-sync skills
- [x] Scaffold Vite design-lab + grimdark tokens
- [x] Port SVG art, primitives, chrome
- [x] Design System showcase page
- [x] Faithful Profile page port
- [x] anime.js motion layer + hero backdrop
- [ ] Follow-up: port grimdark tokens/components into src/components/ui + re-sync Claude Design

---
```

(Leave the eight product phases below unchanged.)

- [ ] **Step 2: Create `design-lab/README.md`** — one-paragraph purpose + `cd design-lab &&
  npm install && npm run dev`, routes `/profile` and `/design-system`, note it is isolated
  from the Next.js app.

- [ ] **Step 3: Commit**

```bash
git add TODO.md design-lab/README.md
git commit -m "docs(todo): add design-lab section + lab README

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin chore/repo-hygiene-and-design-lab
gh pr create --base main --title "Grimdark design-lab + repo hygiene" --body "<summary of groups A–D>"
```
Expected: PR URL printed.

- [ ] **Step 5: Final verification**

Run: `git status --short`
Expected: clean (only ignored tooling remains untracked). `cd design-lab && npm run build`
succeeds. Both routes verified visually.

---

## Self-Review (completed)

- **Spec coverage:** §3 design-lab → Group C; §4 hygiene → Group A; §5 skills → Group B;
  §6 TODO → Task D1; §7 execution order → Group order A→B→C→D. All covered.
- **Placeholder scan:** Faithful ports (art, primitives, rows, Profile, Chrome) reference the
  authoritative design-project source via DesignSync `get_file` rather than inlining hundreds
  of verbatim lines — deliberate for a large visual port; foundational/novel files (scaffold,
  tokens, Button, StatBar, motion, useInView) carry complete code.
- **Type consistency:** `FL` shape and primitive signatures declared once (C2/C4) and reused;
  `data-fl-bar` attribute set in `StatBar` (C4) is the exact selector `barFill` targets (C7);
  `profileData` shapes (C5) consumed by ProfilePage (C6).
- **Open risk:** `Chrome.jsx` size unknown until fetched — C4 Step 4 has a fallback (port
  logged-in Navbar + minimal Footer, record omissions in NOTES.md).
