---
name: Forgotten Letters
description: A self-hosted campaign companion for Trench Crusade in the "Book at night" look. Warm near-black panels, bone text, one blood red and blackletter heads.
colors:
  night: "#15130e"
  inset: "#0e0c09"
  panel: "#221f19"
  panel-raised: "#2b2822"
  panel-hover: "#33302b"
  rule: "#33302a"
  rule-strong: "#565249"
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
  kind-bonus: "#8fb04a"
  kind-attack: "#6aa2d6"
  kind-kit: "#b583d4"
  kind-harm: "#e0574b"
  kind-body: "#e0a23a"
  kind-ground: "#55aab4"
typography:
  display:
    fontFamily: "'Pirata One', 'UnifrakturMaguntia', serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2.4vw, 3.4rem)"
    letterSpacing: "0.06em"
    textTransform: uppercase
  heading:
    fontFamily: "'UnifrakturMaguntia', serif"
    fontSize: "1.9rem"
    color: blood-bright
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
    fontVariantNumeric: oldstyle-nums
  label:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "0.85rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: uppercase
  data:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontVariantNumeric: "lining-nums tabular-nums"
  mono:
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace"
    fontSize: "0.85em"
rounded:
  none: "0px"
  disc: "50%"
borders:
  hairline: "1px"
  opening: "2px"
  card-top: "3px"
  chip-edge: "3px"
  status-edge: "3px"
  focus: "2px"
spacing:
  gutter: "clamp(20px, 3vw, 40px)"
  scale: "4 8 12 16 24 32 48 64"
  measure: "70ch"
density:
  default: comfortable
  comfortable:
    rowHeight: "40px"
    padding: "12px 16px"
  compact:
    rowHeight: "32px"
    padding: "8px 12px"
  button-height: "36px"
shadow:
  overlay: "0 20px 60px rgba(0, 0, 0, 0.6)"
  sign-in-glow: "radial-gradient(blood at 18%)"
motion:
  duration: "150ms 200ms"
  easing: ease-out
  live-flash: "1.5s ember"
  toast: "8s, paused on hover"
  reduced-motion: "all animation off, map weather included"
icons:
  game: "own single-stroke SVG marks, 1.5px"
  ui: "Lucide, bundled, stroke 1.5px"
---

# Design System: Forgotten Letters

## 1. Overview

**North star: "The book at night."** A page held up to a dying lamp: warm near-black ground, bone-coloured text,
one blood red for structure and action, blackletter for the names of things. It is close to the books' own
spreads and to Trench Companion's dark warband pages, so players feel at home at once.

The app is used for hours at a table, often in a dim room. The interface stays calm and still. Hierarchy comes
from typeface changes, ruled lines and stepped surfaces. Fire, motion and texture are kept for the live map.

- Desktop first: design and verify at 1366–1920 px. Phone and TV layouts come later.
- Dark only for now, built on tokens so a light theme can be added (see §13).
- Works fully offline on a LAN: fonts and icons are bundled, nothing loads from a CDN.
- No Trench Crusade art, logos or official fonts. Trench Crusade is named only to describe what the app is for.

## 2. Colour

Every colour is a token. Components use tokens, never raw values. Contrast figures are WCAG ratios against the
named surface.

### Surfaces

| Token | Value | Job | Rules |
|---|---|---|---|
| `night` | #15130e | Page ground behind everything. | All contrast checks start here. |
| `inset` | #0e0c09 | Sunken wells: input fields, code and invite-link boxes, empty roster slots, the map's frame. | Darker than `night`, so a field reads as a hole you type into. |
| `panel` | #221f19 | Cards and panels: roster cards, the sign-in card, side panels, dialogs. | One step up from `night`; needs no shadow. |
| `panel-raised` | #2b2822 | A panel on a panel: table header rows, stat boxes, keyword chips, disabled buttons. | Keep close to `panel`; never a third step on top of it. |
| `panel-hover` | #33302b | Hover and pressed state of table rows, list items, clickable cards. | A small lift only; no flash. |
| `rule` | #33302a | Hairlines between rows and list items, panel borders. | Opaque (bone at about 14% over `night`) so it renders the same everywhere and in exports. Decorative: 1.4:1 on `night`. |
| `rule-strong` | #565249 | Borders that must be seen: field outlines, ghost buttons, chip borders on hover, dividers that open a list. | Bone at about 30% over `night`. 2.4:1 on `night`, 2.1:1 on `panel`: below the 3:1 control target, see "Known misses". |

### Text

| Token | Value | Job | Contrast |
|---|---|---|---|
| `bone` | #ece5d3 | Body copy, values, names, button labels on red. | 14.8 on `night`, 13.1 on `panel`, 11.7 on `panel-raised`. Target 7:1 met. |
| `bone-dim` | #b0a791 | Secondary text that must be read: field labels, captions, table headers, meta lines. | 7.8 on `night`, 6.9 on `panel`, 6.1 on `panel-raised`. Target 4.5:1 met. |
| `bone-faint` | #857b6c | Placeholders, disabled labels, decorative marks. | 4.5 on `night`, 4.0 on `panel`. Allowed to fail. Never put anything here a player must read to play. |

### Accent

| Token | Value | Job | Contrast and rules |
|---|---|---|---|
| `blood` | #a3170f | The one structural accent, as a fill or a line: primary buttons, band headers, the top edge of a card, the rule under a heading. | 2.4 on `night`. **Never text.** `bone` on `blood` is 6.2:1. |
| `blood-bright` | #d8392e | The accent as text or outline at heading size: blackletter section heads, heading-size links, the active tab marker, focus outlines, selected-card rings, error borders. | 4.0 on `night`, 3.6 on `panel`, 3.2 on `panel-raised`. Passes 3:1 for large text and outlines; fails 4.5:1, so **never at body or label size**. |
| `blood-pale` | #d98c80 | The accent as small text: ability names, small labels, inline highlights, links in body text. | 7.1 on `night`, 6.3 on `panel`. Safe at any size. |
| `ember` | #e0692a | Firelight for the live map and live events only: burning territories, a battle in progress, a new-event toast, the live-event flash. | 5.5 on `night`, 4.9 on `panel`. Never on normal buttons. |

### Status

| Token | Value | Job | Rules |
|---|---|---|---|
| `ok` | #8fb04a | Success: saved, joined, battle reported. | 7.5 on `night`. Always with a word or icon. |
| `warn` | #e0a23a | Needs attention: unpaid upkeep, an unconfirmed result, an invite about to expire. Also the Owner badge. | 8.3 on `night`. Always with a label. |
| `danger` | #e0574b | Errors and destructive actions: a failed save, a field to fix, "Delete for good?". | 5.0 on `night`, 4.4 on `panel`, 3.9 on `panel-raised`. Brighter than the accent so it reads as a warning. As text, only on `night` or `inset`, or at heading size. |

### Campaign resources

Used only to say "this is that resource" on discs, counters and the map legend. Never decoration. Always shown with
the resource's name or mark.

| Token | Value | Notes |
|---|---|---|
| `favour` | #e0a23a | Same value as `warn`. |
| `relics` | #d0473b | Kept apart from the accent and danger reds so a relic count never looks like an error. 4.1 on `night`: discs and marks only, not small text. |
| `supplies` | #8fb04a | Same value as `ok`; tell them apart by the mark and label. |
| `territories` | #55aab4 | A cool hue against the warm night and the map's fire; also map ownership borders. |

### Rules

- **The One Accent Rule.** One accent carries structure and action. Emphasis is the accent, bold or blackletter;
  it never gets a second colour. The Owner picks the accent at setup from five presets, each a full set of
  `blood` / `blood-bright` / `blood-pale` values tested for contrast (`app/src/lib/ui/accents.spec.ts`). Blood is
  the default, and the rest of this file says "blood" for whichever accent is active.

  | Preset | `blood` | `blood-bright` | `blood-pale` |
  |---|---|---|---|
  | Blood (default) | #a3170f | #d8392e | #d98c80 |
  | Brass | #8a6a1c | #d4a537 | #e3c88a |
  | Verdigris | #2f6f62 | #4fb39c | #9fd3c4 |
  | Bruise | #5b3a7a | #a57ad1 | #cbb3e6 |
  | Ash | #4d4a44 | #b8b0a0 | #d6cfc0 |

  Applied as `data-accent` on `<html>`. Status colours, resources, keyword kinds and `ember` never change with it.
- **Red text by size.** `blood` never carries text. `blood-bright` only at heading size (24 px, or 19 px bold, and
  up). `blood-pale` for red text at any smaller size.
- **Colour is never the only signal.** Status, resources, roles and keyword kinds always come with a word, a mark
  or both.
- **Ember means live.** If something is not on the map or not a live event, it is not ember.
- **No raw colours** in components. If a colour is missing, add a token here first.

### Known misses and how to use them

| Pair | Ratio | Target | Use |
|---|---|---|---|
| `rule-strong` on `night` / `panel` (field and ghost-button borders) | 2.4 / 2.1 | 3:1 for controls | Fields also differ by their `inset` fill and always have a visible label above. Focus raises the border to `blood-bright`. High-contrast mode raises it to `bone-dim`. |
| `bone` on `blood-bright` (primary button hover) | 3.7 | 4.5:1 | Hover is a short state on a label the user already read. Keep labels short. High-contrast mode keeps the hover on `blood` and adds a `bone` outline. |
| `blood-bright` text on any surface | 3.2–4.0 | 4.5:1 for small text | Heading size only. Body links use `blood-pale`. The active tab shows a `blood-bright` bar and keeps a `bone` label. |
| `danger` text on `panel` / `panel-raised` | 4.4 / 3.9 | 4.5:1 | Danger buttons sit on `night` or carry a danger mark plus a `bone` label inside panels (see Buttons). Field error messages are in `bone` with a danger mark. |
| `bone-faint` | 4.0–4.5 | none | Allowed: placeholders and disabled labels only. |
| `relics` | 4.1 on `night` | 3:1 for graphics | Passes for discs and marks; never small text. |

## 3. Keyword kinds

Keyword chips carry their kind on a 3 px left edge and a drawn mark. The kind colours are used only on the edge and
the mark, never as a fill or text colour. All pass 3:1 against `panel-raised`.

| Kind | Token | Value | Mark | Examples |
|---|---|---|---|---|
| Dice and modifiers | `kind-bonus` | #8fb04a | die | +1 Dice, Injury Modifier, Blessed |
| Attack | `kind-attack` | #6aa2d6 | crossed blades | Assault, Blast, Shrapnel, Ignore Cover |
| Handling (kit) | `kind-kit` | #b583d4 | weight | Heavy, Cumbersome, Shield Combo |
| Markers and dread | `kind-harm` | #e0574b | drop | Blood Marker, Fear, Infection |
| Nature (body) | `kind-body` | #e0a23a | heart | Tough, Strong, Flying, Leader |
| Ground | `kind-ground` | #55aab4 | mound | Cover, Difficult Ground, Dangerous Terrain |
| Tag | none | `rule` edge | none | Elite, faction names |

- `kind-kit` violet is used for nothing else in the app.
- `kind-harm` sits deliberately close to `danger`, because these keywords hurt.
- `kind-attack` blue never competes with the red structure. The Admin badge borrows its value (see Role badges).

## 4. Typography

Three faces, each with one job, plus a mono for codes. All are self-hosted with `@fontsource` packages and bundled
into the app, so the app works offline on a LAN. No font is loaded from a CDN or Google Fonts.

| Role | Face | Setting | Use |
|---|---|---|---|
| Display | **Pirata One** | Uppercase, tracked 0.06em, fluid 2.2–3.4 rem | The app name, page titles, place names. |
| Heading | **UnifrakturMaguntia** | 1.9 rem, `blood-bright` | Section heads, like rubrics in a manuscript. |
| Title | **EB Garamond** 700 | 1 rem, uppercase, tracked 0.06em | Sub-heads (1 px `blood` rule under), card names, band titles. |
| Label | **EB Garamond** 600 | 0.85 rem, uppercase, tracked 0.08em, `bone-dim` | Field labels, table headers, badges. |
| Button | **EB Garamond** 600 | 17 px, uppercase, tracked 0.08em | Button labels. |
| Body | **EB Garamond** 400 | 17 px / 1.55, old-style figures | Everything read. Lines at most 70 characters. |
| Data | **EB Garamond** | Lining tabular figures | Numbers in columns and counters: Ducats, Glory, costs, scores. |
| Mono | **IBM Plex Mono** | 0.85 em | Invite links, setup links, ids, request ids. |

**Rules**

- **The Three Faces Rule.** Pirata One names places and pages, blackletter names sections, Garamond carries
  everything else. Mono only for codes. No other face; no Inter or system UI fonts.
- **Figures.** Old-style figures in prose (`font-variant-numeric: oldstyle-nums`). Lining tabular figures in
  tables, stat boxes, counters and band totals (`lining-nums tabular-nums`).
- Never body copy in a display or blackletter face. Blackletter is never set in all caps.
- Headings use `text-wrap: balance`.
- Sizes are in `rem` so the text size setting (90–130%) scales the whole interface.
- "Replace blackletter" (an accessibility option) sets headings in EB Garamond 700 instead of UnifrakturMaguntia;
  colour and size stay.

## 5. Layout and spacing

- **Density:** comfortable by default (rows about 40 px, 12–16 px padding). Each user can switch to compact (rows
  32 px, 8–12 px padding) in their settings; the choice is stored per user.
- **Base text:** 17 px body. The Owner sets a copy-wide text size from 90 to 130 % in steps of 5 (setup wizard and
  `/owner/settings`); it scales the root font size, so every rem-based size follows.
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48, 64 px. Use only these. Siblings use `gap`, not margins.
- **Reading width:** prose at most 70 characters (`max-width: 70ch`). Reading pages sit in a column up to 72 rem.
  Work surfaces (warband boards, the CM console, the map) use the full width.
- **Gutter:** one side gutter everywhere, `clamp(20px, 3vw, 40px)`.
- **Grouping:** lists and tables open with a 2 px rule (`blood` for a section, `rule-strong` otherwise) and divide
  rows with 1 px `rule` hairlines. Group with rules and space, not with more boxes.
- **Grids** are intrinsic (`repeat(auto-fill, minmax(…))`).
- The Campaign Master's main views (whole warbands, the turn log, map controls) must fit without scrolling at
  1366 × 768 in compact density.
- **First-run split** (welcome, setup and sign-in): two halves divided by a lit seam (a 1 px `blood-bright` line
  that fades at both ends, with a small diamond at its centre). The left half is a dark well around the emblem; the
  right half fades from a faint lift at the seam into near-black at the far edge. Welcome is 1.15fr / 1fr; setup is
  0.8fr / 1.2fr. The welcome page holds the title and Setup, a docs icon at the top right, a "Support us" header
  with round icon links near the bottom, and the legal links under it.
- **App shell:** a top bar (menu toggle, Docs, the app name, the user menu on the right) over a left panel with the
  areas the person can use and, at its foot, the help and legal links. The panel pushes the page; it starts open at
  1920 px and closed at 1366 px.

## 6. Shape and depth

The rules below hold everywhere except the **first-run exceptions** at the end of this section.

- **Square corners** (0 px) on every button, field, card, chip, badge, panel and dialog. Circles only for portraits,
  status dots and resource discs.
- **Borders:** 1 px hairlines everywhere; 2 px only where a list or table opens; 3 px for a card's top edge, a chip's
  kind edge and a message's status edge; 2 px for focus outlines and selected rings.
- **Depth is stepped:** surfaces step up `inset` → `night` → `panel` → `panel-raised`, with 1 px rules. No shadows on
  things that sit in the page.
- **Overlay shadow:** only under things lying over the page or the map (dialogs, sheets, popovers, toasts):
  `0 20px 60px rgba(0, 0, 0, 0.6)`.
- **Accent glow:** only behind the sign-in card: a radial `blood` glow at 18%. Nowhere else.
- **Texture:** none. Surfaces are flat colour. Texture belongs to the live map.

**First-run exceptions** (welcome, setup, sign-in, the shell's top bar and user menu only):

- **Glass buttons.** A translucent body with a 14 px backdrop blur, a light top edge, a dark bottom edge, a soft
  highlight that follows the pointer and 0.6 em corners. The primary button is accent-tinted glass. Labels keep
  4.5:1 over the darkest and lightest backdrop they sit on. Solid buttons replace glass when blur is unsupported or
  the viewer asks for reduced transparency. Glass never sits over the live map, tables or dense text.
- **Wizard controls.** Fields, swatches and tabs have 0.45 em corners and a soft accent focus ring (3 px at 28%);
  errors add a `danger` border plus the reason under the field. A four-part progress stepper heads the wizard.
  Callouts have a full 1 px `rule` border and a faint tint, never a coloured side stripe.
- **Glow:** the radial accent glow sits behind the emblem as well as the sign-in.

## 7. Components

Components are built on Bits UI primitives so keyboard and screen-reader behaviour comes for free (see §14).

### Buttons

36 px tall, 8 px × 18 px padding, label in the button style (Garamond 600, uppercase, tracked 0.08em). One primary
button per area.

| Kind | Look | Hover | Use |
|---|---|---|---|
| Primary | `blood` fill, `bone` label | `blood-bright` fill | The next step: "Sign in", "Send invite". |
| Ghost | Transparent, 1 px `rule-strong` border, `bone` label | Border `blood-bright` | Secondary actions. |
| Danger | Ghost with `danger` label and mark | Border `danger` | Destructive actions. Inside a panel use a `bone` label with the danger mark (see Known misses). |
| Disabled | `panel-raised` fill, `bone-faint` label | none, `not-allowed` cursor | An action not available yet; say why nearby. |

- **Labels** say exactly what happens, one line: "Create account", "Send invite", "Disable account".
- **Icons:** common actions (add, edit, delete, share, copy) get a small Lucide icon before the label. Other buttons
  have no icon.
- **Destructive confirm in place:** pressing "Delete" turns the same button into "Delete for good?" for 4 seconds; a
  second press confirms, otherwise it returns. No modal for this.
- **Icon-only buttons** are allowed in toolbars and map controls. Each has an accessible name and a tooltip with
  the same words.

### Fields

- An `inset` well with a 1 px `rule-strong` border, `bone` text, 8 px padding, square.
- Label above in the label style (`bone-dim`). Hint below in `bone-faint`, only for help that is not needed to fill
  the field; required rules go in the label or in `bone-dim`.
- **Focus:** border `blood-bright` plus the 2 px focus outline.
- **Error:** border `danger`, and a message under the field in `bone` with a danger mark that says how to fix it:
  "That name is taken. Try another."
- **Number entry:** a field with square − and + buttons either side (Ducats, Glory, model counts). Arrow keys step;
  typing works; the value is in lining tabular figures.
- **Checkbox and toggle:** a square `inset` box with a 1 px `rule-strong` border and a drawn tick in
  `blood-bright` when on. The whole label is clickable.
- **Select:** same well as a text field, with a Lucide chevron.

### The sign-in card

- Centred on `night` with the radial `blood` glow at 18% behind it.
- A `panel` card, 3 px `blood` top edge, 1 px `rule` border, up to 20 rem wide, 24 px padding.
- In order: the app name in Pirata One, "Sign in" in `bone-dim`, the username and password fields, "Remember me"
  checkbox, the primary button "Sign in".
- Errors appear as one inline message at the top of the card (see Messages). Wrong password and unknown username
  give the same sentence.
- The same card frames the invite page. Sign-in itself now sits on the right half of the first-run split, with the
  emblem on the left (see §5); setup is the four-step wizard on the same split.

### Skeletons

- While a page's data loads, blocks in `panel-raised` stand where the content will be, in its real sizes (title
  bar, cards, lines), with a slow 1.6 s shimmer. They are replaced in place; nothing jumps.
- Reduced motion: no shimmer.

### The emblem

- Our own design, never the Trench Crusade cross or any official art: four spear-tipped arms around an empty centre
  held by a halo, inside a ring of generated, meaningless glyphs.
- Drawn in the active accent. The ring turns counter-clockwise once every 80 s; the cross never moves.
- Used on the first-run split only.

### Cards and panels

- **Panel:** `panel` fill, 1 px `rule` border all round, content padding 12–16 px. Panels hold areas: the side bar,
  the turn log.
- **Card:** a panel with a 3 px `blood` top edge, then the name in the title style. Cards hold things: a model on a
  warband board, a campaign in a list, a pending invite.
- Stat boxes inside a card use `panel-raised` with lining tabular figures.
- **Clickable card:** hover `panel-hover`.
- **Selected card:** a 2 px `blood-bright` ring (outline) around it.

### Band headers

- A full-width `blood` band, 8 px × 16 px padding.
- The section name in Garamond 700, uppercase, tracked, in `bone` (left).
- Counts and totals on the right, before the actions: lining tabular figures in `bone`. (On `blood`, `bone-dim` is
  only 3.3:1, so totals use `bone`.)
- Actions on the far right as ghost buttons with `bone` borders.
- Used for the lanes of a warband board (Leaders, Elites, Troops) and the groups of a roster. Loud enough to find,
  quiet enough to repeat many times on one page.

### Tables

- **Header row:** `panel-raised`, label style in `bone-dim`, over a 2 px `blood` rule.
- **Rows:** divided by 1 px `rule` hairlines, no stripes. Hover `panel-hover`. Row height follows density.
- **Numbers:** right-aligned, lining tabular figures. Text left-aligned.
- **Sort by column:** click or press Enter on a header. The sorted header shows a Lucide arrow and sets
  `aria-sort`. One sort column at a time.
- **Filter box:** a field above the table, "Filter rows", that narrows rows as you type. Shows "No rows match" when
  empty.
- **Totals row:** a footer row with sums, title style, over a 2 px `rule-strong` rule, figures in `bone`.

### Keyword chips

- `panel-raised` fill, 1 px `rule` border (hover `rule-strong`), 3 px left edge in the kind's colour, square.
- The kind's drawn mark (die, crossed blades, weight, drop, heart, mound) in the kind's colour, then the label in
  Title Case, `bone`, body face: "Assault", "Ignore Cover".
- A chip with rules text shows it in a popover on hover and on keyboard focus. The chip is focusable; Escape closes
  the popover.

### Role badges

- Outlined, square: 1 px border and text in the role colour, label style, full words.

| Role | Colour |
|---|---|
| Owner | `warn` |
| Admin | #6aa2d6 (the `kind-attack` value) |
| User | `bone-dim` |
| Campaign Master | `blood-bright`. At label size this misses 4.5:1, so the word is set at 19 px bold or the badge uses `blood-pale` text with a `blood-bright` border. |

- Badges sit next to names in member lists, invites and the turn log. The word is always shown.

### Messages and toasts

- **Inline messages** are the default. They sit next to what they are about: a 3 px left edge in `ok`, `warn` or
  `danger`, a matching mark, and one plain sentence in `bone`.
- **Toasts** are only for things that happened elsewhere (a player reported a battle while the Campaign Master is
  on the map). Bottom right, stacked, `panel` with the overlay shadow and a 3 px status edge (`ember` for a live
  event). Each stays 8 seconds and pauses while the mouse is over it or it has focus. A close button is always there.
  Toasts are announced politely (`aria-live="polite"`).
- **Error wording:** plain and fixing. Say what went wrong and what to do: "That name is taken. Try another." Show
  the request id in mono on unexpected errors so it can be reported.

### Empty states

- A sentence that says what will appear here and how to add the first one, and the primary action as a button.
- Plain wording: "No warbands yet. Create one to join this campaign."
- A link to the relevant help page under the button.
- No illustration or flavour text.

### Iconography

Two sets, one stroke weight (1.5 px), drawn in `currentColor`.

| Set | Source | Use |
|---|---|---|
| Game marks | Our own single-stroke SVG marks (about 40), in the repo | Game concepts: keyword kinds, resources (Favour, Relics, Supplies, Territories), Glory, Ducats, battles, warbands, map markers. |
| UI icons | Lucide, installed as a package and bundled | Interface actions: add, edit, delete, share, copy, search, sort, close, menu, settings, chevrons. |

- Lucide icons are set to stroke width 1.5 so both sets match.
- No icon is loaded from a CDN.
- Never use a Lucide icon for a game concept, or a game mark for a UI action.
- Icon-only buttons need an accessible name and a tooltip.

### Imagery

- The app ships no Trench Crusade art. Every image is uploaded by the group or made for the project.
- **Photos of miniatures:** players upload photos of their models and warbands. Shown natural (as uploaded), in a
  circle portrait crop.
- **Warband heraldry:** upload a crest or pick one from a set of project-made crests.
- The server resizes every upload (one phone photo must not fill the disk) and strips metadata.
- A missing photo shows a circle in `panel-raised` with the model's initial in the title style.

## 8. Motion

- **Interface:** subtle. 150–200 ms ease-out fades and colour changes for hover and state changes. Nothing bounces.
  Only these may move:
  - the emblem's ring (it turns; the cross stays still);
  - the first-run entrance (the emblem fades up, the seam draws from its centre, the welcome items rise in turn) and
    the hand-off from welcome to setup (the seam glides left in 400 ms or less, the emblem shrinks);
  - wizard steps (cross-fade with a short slide);
  - the shell's left panel (slides in 220 ms).

  All use ease-out curves (anime.js 4), and content is visible without them: an animation only adds to a page that
  already shows everything.
- **Live event highlight:** the changed row or card glows `ember` for 1.5 s, then returns.
- **The live map** may animate (see §12).
- **Reduced motion:** when `prefers-reduced-motion: reduce` is set, all animation is off, the map's weather, fire and
  movement included, and the emblem's ring stands still. State changes still show, as instant colour changes.

## 9. Accessibility

Target: **WCAG 2.2 AA** (4.5:1 for body text, 3:1 for large text and controls). Known misses are listed in §2.

- Every control is reachable and usable by keyboard, with a visible 2 px `blood-bright` focus outline
  (`:focus-visible`, 2 px offset).
- Every field has a visible label; every icon-only button has an accessible name.
- Colour is never the only signal.
- No text in `blood`. `blood-bright` text only at heading size.
- **Palette contrast guard:** wherever the palette can be changed later, the app shows the ratio and a warning
  below target, and allows the change.
- **User options**, stored per user:
  - Text size 90–130%.
  - High-contrast mode: `bone` for all text (`bone-dim` becomes `bone`), `rule` becomes `rule-strong`,
    `rule-strong` becomes `bone-dim`.
  - Replace blackletter: headings in the body face.
  - Density: comfortable or compact.

## 10. Do and don't

**Do**

- Use the book's words: Campaign Master, warband, Glory, Ducats.
- Keep one red; let type, rules and surface steps make hierarchy.
- Put messages next to what they are about.
- Show real content in mockups, and empty states that teach.
- Use tokens for every colour, size and space.

**Don't**

- Rounded corners, gradients on surfaces, glassmorphism, texture outside the map.
- A fourth typeface beside mono, or Inter and system UI fonts.
- Colour without meaning, red text in `blood`, or ember outside live things.
- Shadows on things that sit in the page.
- Motion in the interface beyond fades and colour changes.
- Load fonts, icons or scripts from a CDN.
- Use Trench Crusade art, logos or official fonts.

## 11. Print and PDF

- A light print sheet for rosters and results: black text on white, `blood` kept for rules and band edges, no
  surfaces or glow.
- Done with a print stylesheet over the same tokens.

## 12. The live map's register

The live map is the campaign's shared screen: territories, warbands, battles, weather. It is the one place the
design may be loud. The interface around it stays calm.

- **Look:** an inked chart. `bone` lines on dark ground, like a field map drawn by hand.
- **Register:** louder than the app. `ember`, fire, weather and battle effects are allowed here only.
- **Labels:** Garamond caps, tracked, with a dark halo so they read over any terrain. Never smaller than the body
  size; the map is often shown on a TV across a room.
- **Effects:**
  - Fire on contested territories: `ember` glow and flicker.
  - Fog of war: hidden territories under smoke.
  - Animated movement paths: warband moves drawn as dashed lines.
- Ownership borders and legend use the resource and `territories` tokens.
- Map controls and panels over the map are ordinary components (HTML overlays) with the overlay shadow.
- Reduced motion turns every map animation off.

## 13. Light theme

- **Dark now, light later.** Only the dark theme ships. Every component uses tokens from day one, so a light theme
  is a second set of token values, not a rewrite.
- A light theme, when added, must be tested on every component and pass the same contrast table.

## 14. Tokens in code

- All tokens live as CSS custom properties in one file, `tokens.css`, on `:root`: colours (`--night`,
  `--panel-raised`, `--kind-attack`, …), type, spacing, borders, shadows and motion. The names match the front
  matter.
- User options (density, high contrast, replace blackletter, text size) are attributes on `<html>` that override
  tokens in the same file.
- Components use plain CSS with Svelte scoped styles on Bits UI primitives. No CSS framework, no utility classes,
  no CSS-in-JS.
- Fonts are imported from `@fontsource` packages; Lucide comes from its Svelte package. Both are bundled.
- Components never use a raw colour or size. A missing value is added to `tokens.css` and to this document.
