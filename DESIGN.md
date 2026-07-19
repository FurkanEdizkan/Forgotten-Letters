<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->

---

name: Forgotten Letters
description: A gritty, tactical scenario repository for Trench Crusade wargaming — war-room instrument glow on oxidized steel.
---

# Design System: Forgotten Letters

## 1. Overview

**Creative North Star: "The War Room at Night"**

Forgotten Letters is a scenario-building tool that should feel like a field command post, not a hobby website. Dark by default — a near-black tactical surface carries the mood, lit by a cold steel-blue instrument glow and stained with the rust and oxblood of the grimdark WWI-occult source material. The register is **product**: the interface serves the work of building, publishing, and discovering scenarios. Atmosphere is earned through color, type, and material — never bolted on as decoration over a generic layout.

This system commits to a dark, saturated environment because the surface _is_ part of the brand (the war-room mood lives in the near-black tactical field), then holds the steel-blue as a single confident primary and rust/oxblood as its counter-voice. Discovery should feel like sifting archives and field intel; creation should feel like operating precise tactical software. When atmosphere and legibility conflict, legibility wins — dense tactical data (event tables, map coordinates, filters, multi-step forms) stays scannable.

It explicitly rejects the generic SaaS dashboard: no cream/sand AI-SaaS surface, no gradient-hero templates, no identical card grids, no theme-agnostic startup shell. It equally rejects the opposite failure — childish, cartoonish game-site brightness. The tone is serious, competent, and grim.

**Key Characteristics:**

- Dark-first, committed: near-black tactical surface, not a dark-mode afterthought.
- Instrument glow: a single cold steel-blue primary reads like a readout against cold light.
- Grimdark counter-voice: rust/oxblood accent carries the blood-and-iron note, used deliberately.
- Legible under pressure: dense data stays scannable; clarity beats mood in a conflict.
- Tool-craft, not engagement bait: precise, confident, no gamified sheen.

## 2. Colors

A committed dark palette: a near-black tactical field, a cold steel-blue instrument primary, and a rust/oxblood accent for the grimdark note. Exact tokens are resolved during implementation; anchors below.

### Primary

- **Instrument Steel-Blue** (`oklch(0.65 0.16 250)` — anchor; exact value `[to be resolved during implementation]`): The instrument-glow primary. Interactive affordances, active tool state, links, focus glow, key data readouts. Reads like signal light on cold glass against the near-black field.

### Secondary

- **Oxblood Rust** (`oklch ~0.50 0.13 35` — anchor; exact `[to be resolved during implementation]`): The grimdark counter-voice — blood-and-iron. Destructive actions, warnings, deliberate atmospheric emphasis. Distinct from primary in both hue and lightness. Used sparingly; its rarity is the point.

### Neutral

- **Tactical Field** (near-black, low steel tint — `[to be resolved]`): The primary surface. The war-room mood lives here.
- **Panel / Elevated Surface** (field pulled slightly toward ink — `[to be resolved]`): Cards, panels, toolbars, the map-editor chrome.
- **Ink** (near-white, faint steel cast — `[to be resolved]`): Body text; must reach ≥7:1 contrast on the field (WCAG AA baseline, targeting AAA for body).
- **Muted** (ink pulled toward field — `[to be resolved]`): Secondary text, metadata, timestamps; ≥4.5:1 contrast, never the washed-out light-gray default.

### Named Rules

**The Field Carries the Mood Rule.** Atmosphere lives in the dark surface, the steel primary, and the type — never in decorative gradients or glass. If the mood needs a gradient to read, the palette has failed.

**The Rust Is Rare Rule.** Oxblood is the counter-voice, not a second primary. It appears on destructive intent and rare deliberate emphasis only. Everyday accents are steel-blue.

## 3. Typography

**Display Font:** `[condensed / militaria-adjacent display — to be chosen at implementation]` (fallback: a strong condensed grotesk, then `sans-serif`)
**Body Font:** `[technical sans — to be chosen at implementation]` (fallback: `system-ui, sans-serif`)
**Label/Mono Font:** `[technical monospace — to be chosen at implementation]` (fallback: `ui-monospace, monospace`)

**Character:** A condensed, slightly severe display for headings sets the tactical/field-manual register; a technical monospace carries structured data (event tables, dice ranges, coordinates, IDs, filter tokens) so numbers read like instrument output. Pair on a clear contrast axis (condensed display vs. neutral body vs. mono data) — never two similar sans families.

### Hierarchy

- **Display** (heavy/condensed, `clamp()` max ≤ 6rem, line-height ~1, letter-spacing ≥ -0.04em): Page and section titles; the field-manual header voice.
- **Headline** (semibold, ~1.5–2rem): Sub-section and panel headers.
- **Title** (medium, ~1.125–1.25rem): Card titles, form group headers, tool labels.
- **Body** (regular, ~1rem, line-height ~1.6, max 65–75ch): Scenario stories, descriptions, comments, rules content.
- **Label / Data** (mono, ~0.8125–0.875rem, moderate tracking): Event-table entries, coordinates, tags, metadata, filter chips. The instrument-readout voice.

### Named Rules

**The Data Is Mono Rule.** Structured, numeric, or coordinate data (event tables, dice ranges, player counts, IDs) is set in the monospace face. Prose is not. The contrast is the tactical signal.

## 4. Elevation

Responsive motion, mostly-flat depth. Surfaces are flat at rest; depth is conveyed by tonal layering (field → panel → elevated panel), not by soft ambient shadows. Shadows appear as a _response to state_ — a focused input, a lifted dropdown, a dragged map shape — not as a decorative resting glow. Glassmorphism is prohibited.

### Named Rules

**The Flat-Field Rule.** Panels are distinguished by tonal step, not by drop shadow. A shadow means something moved or gained focus.

## 5. Components

<!-- No components exist yet (pre-implementation). Re-run /impeccable document once shadcn/ui primitives and the map editor exist to capture real component tokens, states, and the sidecar. -->

## 6. Do's and Don'ts

### Do:

- **Do** commit to the dark tactical field as the default surface; let the steel-blue primary and type carry the mood.
- **Do** set structured/numeric data (event tables, dice ranges, coordinates, IDs) in the monospace face.
- **Do** keep dense data scannable — legibility beats atmosphere when they conflict.
- **Do** verify contrast on the dark palette: body text ≥7:1, secondary ≥4.5:1, and colorblind-safe distinctions for map-editor deployment-zone colors.
- **Do** reserve oxblood/rust for destructive actions and rare deliberate emphasis.
- **Do** honor `prefers-reduced-motion` with a crossfade or instant alternative for every transition.

### Don't:

- **Don't** build a generic SaaS dashboard: no cream/sand AI-SaaS surface, no gradient-hero templates, no identical icon-heading-text card grids.
- **Don't** go childish or cartoonish — the tone is grimdark and serious, never playful game-store brightness.
- **Don't** use glassmorphism, gradient text (`background-clip: text`), or side-stripe borders (`border-left` > 1px as a colored accent).
- **Don't** put the mood in a decorative gradient; if the palette needs one to read, fix the palette.
- **Don't** let oxblood become a second primary — its rarity is the point.
- **Don't** pair two similar sans families; keep the display / body / mono contrast axis sharp.
