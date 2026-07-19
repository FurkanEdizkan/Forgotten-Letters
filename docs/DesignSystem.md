# Design System

The visual language for Forgotten Letters, ported from the Claude Design bundle's
`tokens.jsx` and its **Design System Color** artboard. This is the source of truth for the
future UI implementation — every component should draw only from these tokens, fonts, and
ratios.

The aesthetic is **grimdark / WWI-meets-hellscape**: mostly mud (dark surfaces), sparse
gilding (gold), and blood-red command accents. As the color page puts it:
**"A trench is mostly mud. The gilding is rare — that's why it reads."**

## The 16 tokens (01–16)

Numbered so reviews can cite "token 09" instead of "the gold". Grouped Surfaces (01–05) ·
Text (06–08) · Accent (09–12) · Action (13–16).

### Surfaces — ~60% of any screen

| #   | Name                | Hex       | Role                                     |
| --- | ------------------- | --------- | ---------------------------------------- |
| 01  | Charcoal Black      | `#0C0C0E` | App canvas / page background, stat wells |
| 02  | Ash Gray            | `#1A1A1F` | Card / panel / navbar / footer surface   |
| 03  | Smoke               | `#252529` | Elevated surface (modals, raised cards)  |
| 04  | Trench Gray         | `#2E2E35` | Borders, dividers, stat separators       |
| 05  | Trench Gray (hover) | `#3A3A42` | Hover/active border                      |

### Text — ~18%

| #   | Name       | Hex       | Role                                      |
| --- | ---------- | --------- | ----------------------------------------- |
| 06  | Bone White | `#E8E2D6` | Primary text                              |
| 07  | Dust       | `#9B9484` | Secondary text, keyword chips, nav labels |
| 08  | Iron       | `#5C574E` | Muted text, captions, placeholders        |

### Accent — ~8% (the gilding — use sparingly)

| #   | Name           | Hex       | Role                                                      |
| --- | -------------- | --------- | --------------------------------------------------------- |
| 09  | Tarnished Gold | `#B8923F` | Primary accent: selected state, Ducat glyph, gold kickers |
| 10  | Aged Brass     | `#8A6D2F` | Secondary gold: avatars, featured borders                 |
| 11  | Blood Red      | `#8B1A1A` | Brand/command accent: primary buttons, active underline   |
| 12  | Crimson        | `#A52222` | Blood Red hover                                           |

### Action — ~8% (status only)

| #   | Name        | Hex       | Role                 |
| --- | ----------- | --------- | -------------------- |
| 13  | Verdigris   | `#2D6B4F` | Success              |
| 14  | Mustard Gas | `#B8860B` | Warning              |
| 15  | Flare Red   | `#C0392B` | Danger / destructive |
| 16  | Steel Blue  | `#4A6FA5` | Info / editor notes  |

## The ratio contract

Group budget across a screen: **Surfaces 60% · Text 18% · Accent 8% · Action 8%** (the
remaining ~6% is incidental). The hard rule: **if a screen is more than ~10% gold (09),
gold stops meaning anything.** Accent and action colors are spotlights, not fields. A
fighter card, for example, uses 8 of 16 tokens and _no_ action colors — by design.

## Forbidden combinations (✗)

From the color page — these collide and must not be paired:

- **11 + 15** — Blood Red beside Flare Red: two reds clash
- **09 + 14** — Gold beside Mustard Gas: warm-saturation collision
- **11 + 14** — Blood Red beside Mustard: carnival
- **08 + 01** — Iron text on Charcoal: fails contrast
- **06 + 09** — Bone on Gold: washes both out
- **13 + 16** — Verdigris beside Steel Blue: ambiguous cools

## Blessed combinations (✓)

- **06 on 01** — Bone White on Charcoal: body reading
- **09 on 02** — Gold on Ash: highlight / kicker
- **06 on 11** — Bone on Blood Red: command buttons

## Typography

| Family                          | Use                                         | Token               |
| ------------------------------- | ------------------------------------------- | ------------------- |
| **Cinzel** (500/600/700, serif) | Display: headings, brand wordmark, numerals | `--fl-font-display` |
| **Inter** (400–700, sans)       | Body, UI labels, forms                      | `--fl-font-body`    |
| **JetBrains Mono** (400/500)    | Stat lines, codes, kickers, mono captions   | `--fl-font-mono`    |

Loaded from Google Fonts (see `tokens.jsx`). Display headings use letter-spacing ~0.02em;
mono kickers use wide tracking (0.1–0.4em) in gold caps.

## Texture & iconography

- **Grain overlay** (`.fl-grain`): a faint (opacity ~0.04) fractal-noise SVG, applied
  **only** on hero / auth / error backgrounds — never on dense data surfaces.
- **Icons:** lucide-style 24×24 stroke icons (`strokeWidth=2`, round caps), from the `I`
  set in `tokens.jsx`. Touch targets ≥ 44px (mobile) / ≥ 32px (dense desktop tools).
- **Brand mark:** an original wax-seal / envelope sigil (`FLMark` in `Chrome.jsx`) — not
  any publisher's IP.

## Porting to the app (Tailwind v4 + CSS variables)

Define the tokens once as CSS custom properties, then expose them to Tailwind v4 via
`@theme`. Drop this into `globals.css` during the app bootstrap:

```css
:root {
  /* Surfaces */
  --fl-01-charcoal: #0c0c0e;
  --fl-02-ash: #1a1a1f;
  --fl-03-smoke: #252529;
  --fl-04-trench: #2e2e35;
  --fl-05-trench-hi: #3a3a42;
  /* Text */
  --fl-06-bone: #e8e2d6;
  --fl-07-dust: #9b9484;
  --fl-08-iron: #5c574e;
  /* Accent */
  --fl-09-gold: #b8923f;
  --fl-10-brass: #8a6d2f;
  --fl-11-blood: #8b1a1a;
  --fl-12-crimson: #a52222;
  /* Action */
  --fl-13-verdigris: #2d6b4f;
  --fl-14-mustard: #b8860b;
  --fl-15-flare: #c0392b;
  --fl-16-steel: #4a6fa5;

  --fl-font-display: "Cinzel", Georgia, serif;
  --fl-font-body: "Inter", -apple-system, sans-serif;
  --fl-font-mono: "JetBrains Mono", ui-monospace, monospace;
}

@theme inline {
  --color-bg: var(--fl-01-charcoal);
  --color-surface: var(--fl-02-ash);
  --color-elevated: var(--fl-03-smoke);
  --color-border: var(--fl-04-trench);
  --color-text: var(--fl-06-bone);
  --color-text-2: var(--fl-07-dust);
  --color-muted: var(--fl-08-iron);
  --color-gold: var(--fl-09-gold);
  --color-brass: var(--fl-10-brass);
  --color-blood: var(--fl-11-blood);
  --color-crimson: var(--fl-12-crimson);
  --color-success: var(--fl-13-verdigris);
  --color-warn: var(--fl-14-mustard);
  --color-danger: var(--fl-15-flare);
  --color-info: var(--fl-16-steel);
  --font-display: var(--fl-font-display);
  --font-sans: var(--fl-font-body);
  --font-mono: var(--fl-font-mono);
}
```

This yields utilities like `bg-bg`, `bg-surface`, `border-border`, `text-text-2`,
`text-gold`, `bg-blood`, `font-display`, `font-mono` — matching the prototype's intent
while staying idiomatic Tailwind. shadcn/ui primitives should be themed from the same
variables so the whole UI shares one palette.
