# Forgotten Letters — Design Lab

A standalone **Vite + React** sandbox for exploring the grimdark ("War Room" blood /
tarnished-gold / Cinzel) visual direction, ported from the Claude Design project. It is
**isolated** from the main Next.js app — its own `package.json` and dependencies, no shared
imports.

## Run

```sh
cd design-lab
npm install
npm run dev      # http://localhost:5173
```

Routes:

- `/profile` — the faithful grimdark public-profile page (Varius Castellan).
- `/design-system` — token swatches, type scale, and a live gallery of every primitive.

## What's inside

- `src/tokens/` — grimdark palette (`colors.ts`) + global CSS (`theme.css`).
- `src/components/primitives/` — Button, Pill, BadgeChip, Section, StatBar, RecordCell,
  MetricCell, and the profile row components.
- `src/components/art/` — SVG fighter portraits, faction sigil, icon set.
- `src/components/chrome/` — Navbar + Footer.
- `src/lib/` — anime.js motion helpers (reveal, count-up, bar-fill, split-text), all gated
  behind `prefers-reduced-motion`.

Once the direction is validated here, the tokens + primitives get ported into the main
app's `src/components/ui` (tracked in the root `TODO.md`).
