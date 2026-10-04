---
name: Forgotten Letters
description: A campaign companion for Trench Crusade, set in the book's painted night — dark panels, bone text, blood red and blackletter.
colors:
  night: "#15130e"
  inset: "#0e0c09"
  panel: "#221f19"
  panel-raised: "#2b2822"
  panel-hover: "#33302b"
  rule: "rgba(236, 229, 211, 0.14)"
  rule-strong: "rgba(236, 229, 211, 0.3)"
  bone: "#ece5d3"
  bone-dim: "#b0a791"
  bone-faint: "#857b6c"
  blood: "#a3170f"
  blood-bright: "#d8392e"
  blood-pale: "#d98c80"
  ember: "#e0692a"
  ok: "#8fb04a"
  warn: "#e0a23a"
  danger: "#e0574b"
  favour: "#e0a23a"
  relics: "#d0473b"
  supplies: "#8fb04a"
  territories: "#55aab4"
typography:
  display:
    fontFamily: "'Pirata One', 'UnifrakturMaguntia', serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2.4vw, 3.4rem)"
    letterSpacing: "0.06em"
    textTransform: uppercase
  heading:
    fontFamily: "'UnifrakturMaguntia', serif"
    fontSize: "1.9rem"
  title:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "1rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    textTransform: uppercase
  body:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "17px"
    lineHeight: 1.55
  label:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "0.85rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: uppercase
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "0.85em"
rounded:
  none: "0px"
  disc: "50%"
spacing:
  gutter: "clamp(20px, 3vw, 40px)"
  scale: "4 8 12 16 24 32 48 64"
---

# Design System: Forgotten Letters

## 1. Overview

**North star: "The book at night."** Trench Crusade's art is dark, smoky and fire-lit; its books are set in
blackletter and old-style serif. Forgotten Letters lives in that night everywhere: dark panels on a near-black
ground, bone-coloured text, one blood red for structure and action, and blackletter for the names of things.

It is a tool used for hours at a table, so it is calm and dense like a printed rulebook, not loud like a game
menu. Hierarchy comes from typeface changes and ruled lines, not from colour, cards or shadows. Corners are square
everywhere.

Desktop first (1366–1920 px). Other screen sizes come later.

## 2. Colour

One red carries structure; everything else is the night and its bone text. The palette is single-theme (dark) by
choice.

| Token | Value | Use |
|---|---|---|
| `night` | #15130e | Page background. |
| `inset` | #0e0c09 | Wells inside a panel: code, link boxes, empty slots, input fields. |
| `panel` | #221f19 | Panels, cards, the sign-in card. |
| `panel-raised` | #2b2822 | A panel on a panel: table header rows, stat boxes, chips. |
| `panel-hover` | #33302b | Hover state of rows and clickable panels. |
| `rule` / `rule-strong` | bone at 14% / 30% | Hairlines between rows; borders of fields and ghost buttons. |
| `bone` | #ece5d3 | Body text, values. |
| `bone-dim` | #b0a791 | Secondary text: labels, captions, meta. |
| `bone-faint` | #857b6c | Placeholders, disabled text (never for anything that must be read). |
| `blood` | #a3170f | **Fills and lines only**: primary buttons, band headers, the top edge of a card, rules under headings, focus rings on fills. Too dark for text. |
| `blood-bright` | #d8392e | Red **text** at heading size, links, the active tab, focus outlines, error borders. |
| `blood-pale` | #d98c80 | Red **text** at small size: ability names, small labels on dark. |
| `ember` | #e0692a | Firelight: map effects and live-event highlights only. |
| `ok` / `warn` / `danger` | #8fb04a / #e0a23a / #e0574b | Status: success, needs attention, failed. Always paired with a word or icon, never colour alone. |
| `favour` `relics` `supplies` `territories` | see front matter | The four campaign resources, only to identify a resource. |

**Rules**
- **The One Red Rule.** Blood red is the only accent for structure and action. Emphasis is red, bold or
  blackletter; it never gets a new colour.
- **Status colours mean status.** Green, amber and the danger red appear only for state, with a label.
- **Contrast.** Body text (`bone` on `night`/`panel`) and secondary text (`bone-dim`) pass WCAG AA; red text uses
  `blood-bright` (large) or `blood-pale` (small), never `blood`.

### Keyword kinds

Keyword chips carry their kind on a 3 px left edge and a drawn mark:

| Kind | Colour | Examples |
|---|---|---|
| Dice and modifiers | #8fb04a | +1 Dice, Injury Modifier, Blessed |
| Attack | #6aa2d6 | Assault, Blast, Shrapnel, Ignore Cover |
| Handling | #b583d4 | Heavy, Cumbersome, Shield Combo |
| Markers and dread | #e0574b | Blood Marker, Fear |
| Nature | #e0a23a | Tough, Strong, Flying, Leader |
| Ground | #55aab4 | Cover, terrain |
| Tag | none | Elite, faction names |

## 3. Typography

Three faces, each with one job, self-hosted (`@fontsource`), never loaded from a CDN in the app.

| Role | Face | Use |
|---|---|---|
| Display | **Pirata One**, uppercase, tracked 0.06em | The app name, page titles. |
| Heading | **UnifrakturMaguntia** (blackletter), in `blood-bright` | Section heads. |
| Title / label | **EB Garamond** 600–700, uppercase, tracked | Sub-heads (with a 1 px `blood` rule under), buttons, table headers, field labels. |
| Body | **EB Garamond** 400, 17 px / 1.55, old-style figures | Everything read. Lines at most 70 characters. |
| Data | EB Garamond with lining tabular figures | Numbers in columns: costs, scores, counts. |
| Mono | IBM Plex Mono | Codes, links, ids. |

**Rules**
- **The Three Faces Rule.** Pirata One names places and pages, blackletter names sections, Garamond carries
  everything else. No fourth face; never body copy in a display face.
- Headings use `text-wrap: balance`.

## 4. Layout

- Page column up to 72 rem for reading pages; work surfaces (consoles, boards, the map) use the full width.
- One side gutter (`clamp(20px, 3vw, 40px)`) everywhere.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px. Siblings use `gap`, not margins.
- Lists and tables open with a 2 px rule (red for a section, ink-light otherwise) and separate rows with
  hairlines. Group with rules and space, not boxes.
- Grids are intrinsic (`auto-fill`, `minmax(…)`).

## 5. Shape and depth

- **Square corners** on every button, field, card, chip and panel. Circles only for portraits, status dots and
  resource discs.
- Depth is the panel colour stepping up (`night` → `panel` → `panel-raised`), not shadows. A shadow appears only
  under something lying over the map or over the page (a dialog, a sheet): `0 20px 60px rgba(0,0,0,0.6)`.
- A card has a 3 px `blood` top edge; a selected card a 2 px `blood-bright` ring.

## 6. Components

### Buttons
- **Primary:** `blood` fill, `bone` label in the label style, 8 px 18 px padding. Hover: `blood-bright`.
- **Ghost:** transparent, 1 px `rule-strong` border, `bone` label. Hover: border `blood-bright`.
- **Danger:** ghost with `danger` text; confirms in place ("Delete" → "Delete for good?").
- **Disabled:** `panel-raised` fill, `bone-faint` label, `not-allowed` cursor.
- Labels say exactly what happens ("Create account", "Send invite"), one line.

### Fields
- `inset` background, 1 px `rule-strong` border, `bone` text, 8 px padding, square.
- Focus: border `blood-bright` plus a 1 px ring. Error: `danger` border and a message under the field saying how
  to fix it.
- Labels above the field in `bone-dim`; hints under it in `bone-faint`.

### The sign-in card
- Centred on `night` with a faint red glow behind (radial `blood` at 18%).
- `panel` card, 3 px `blood` top edge, up to 20 rem wide.
- The app name in Pirata One, "Sign in" in `bone-dim`, fields, "Remember me", the primary button.
- One error line at the top, left-bordered in `blood-bright`.

### Band header
- A full-width `blood` band with the section name in bone (Garamond 700) and its actions on the right as ghost
  buttons with light borders. Used for the lanes of a board and the groups of a roster.

### Panels and cards
- `panel` with a 1 px `rule` border; content padding 12–16 px.

### Tables
- Header row: label style in `bone-dim` over a 2 px `blood` rule. Rows divided by `rule`; hover `panel-hover`.
  Numbers right-aligned, tabular.

### Chips
- `panel-raised`, 1 px `rule` border, 3 px left edge in the keyword kind's colour, the kind's mark, title-case
  label. A chip with an explanation shows it on hover or focus.

### Role badges
- Outlined, label style: Owner `warn`, Admin `#6aa2d6`, User `bone-dim`.

### Messages
- Inline, next to what they are about: a left border in `ok` / `warn` / `danger` and a sentence. Toasts only for
  something that happened elsewhere (a live update).

### Empty states
- Say what will appear and how to add the first one, with the action as a button.

## 7. Motion

- 150–200 ms ease-out for hover and state changes; nothing bounces.
- The live map may animate (weather, battles); interface panels don't.
- `prefers-reduced-motion` turns animation off.

## 8. Accessibility

- Every control reachable and usable by keyboard, with a visible focus outline (2 px `blood-bright`).
- Every field has a label; every icon-only button an accessible name.
- Colour is never the only signal.
- Text at least AA contrast; no text in `blood`.

## 9. Do and don't

**Do**
- Use the book's words (Campaign Master, warband, Glory, Ducats).
- Keep one red; let type and rules make hierarchy.
- Show real content in mockups and empty states that teach.

**Don't**
- Rounded corners, gradients on surfaces, glassmorphism.
- A fourth typeface, or Inter/system UI fonts in the app.
- Colour without meaning, or red text in `blood`.
- Load fonts or scripts from a CDN in the app (it must work offline on a LAN).
