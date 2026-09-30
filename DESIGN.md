---
name: Carcass Front
description: A live campaign tracker for Trench Crusade, bound like its campaign book with rulebook pages and a painted night around the map.
colors:
  blood: "#a3170f"
  blood-bright: "#c8231a"
  ember: "#e0692a"
  paper: "#fbfaf7"
  parchment: "#f1efea"
  wash-deep: "#dedbd4"
  ink: "#151210"
  ink-soft: "#3a332c"
  muted: "#6a6159"
  rule: "#c8c3ba"
  night: "#15130e"
  smoke: "#3a3829"
  bone: "#ece5d3"
  bone-dim: "#b0a791"
  favour: "#c8741e"
  relics: "#9b2a1c"
  supplies: "#5a7a26"
  territories: "#2f6770"
typography:
  display:
    fontFamily: "'Pirata One', 'UnifrakturMaguntia', serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2.4vw, 3.4rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.06em"
  headline:
    fontFamily: "'UnifrakturMaguntia', serif"
    fontSize: "1.9rem"
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.04em"
  body:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'onum'"
  label:
    fontFamily: "'EB Garamond', Georgia, serif"
    fontSize: "0.92rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  nav:
    fontFamily: "'Pirata One', 'UnifrakturMaguntia', serif"
    fontSize: "1.05rem"
    fontWeight: 400
    letterSpacing: "0.1em"
  footer:
    fontFamily: "'UnifrakturMaguntia', serif"
    fontSize: "1rem"
    fontWeight: 400
rounded:
  none: "0px"
  disc: "50%"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "7px 16px"
  button-primary-hover:
    backgroundColor: "{colors.blood}"
    textColor: "{colors.paper}"
  button-disabled:
    backgroundColor: "{colors.wash-deep}"
    textColor: "{colors.muted}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "7px 16px"
  button-ghost-hover:
    textColor: "{colors.blood}"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "6px 8px"
  rules-box:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 14px 12px"
  masthead:
    backgroundColor: "{colors.night}"
    textColor: "{colors.bone-dim}"
    typography: "{typography.nav}"
    padding: "10px clamp(16px, 4vw, 40px)"
  night-chip:
    backgroundColor: "rgba(21, 19, 14, 0.78)"
    textColor: "{colors.bone}"
    typography: "{typography.nav}"
    rounded: "{rounded.none}"
    padding: "5px 12px"
  book-page-sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "18px 22px 22px"
    width: "min(27rem, calc(100% - 28px))"
  tracker-box:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "3px 2px"
    height: "3.6rem"
  running-foot:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.footer}"
  table-header:
    backgroundColor: "{colors.wash-deep}"
    textColor: "{colors.ink}"
    padding: "2px 4px"
---

# Design System: Carcass Front

## Overview

**Creative North Star: "The Book, Bound"**

The app is the *Carcass Front* campaign book turned into software, and it keeps the book's two registers. Everything that is read or filled in (standings, rosters, zone lore, the chronicle, every admin form) is a **rulebook page**: bright white paper, black Garamond, red blackletter section heads, bold capital sub-heads ruled in red, grey-washed callout boxes with a red hairline, and a blackletter running footer on a long black hairline. Around the live map the book turns into a **painted night**: an olive-black field, bone text, ember and red accents, with the map lit as a plate in the middle. Pages of the book slide in over that night whenever a zone, player or battle is opened.

It is dense like a printed rulebook, not spacious like a marketing page. Hierarchy comes from typeface changes (spiky title capitals, then blackletter, then Garamond) and from ink rules, not from cards, fills or elevation. There are no rounded rectangles anywhere. It rejects the generic cream-parchment fantasy look and the dark admin dashboard. The only dark surfaces are the night register and the black mastheads that bind the page register.

The build honours the book without copying it. Glyphs are drawn as authored single-stroke SVG marks, the Crusade cross is a solid cross pattée, and no book art or text is embedded in the UI chrome.

**Key Characteristics:**
- Two registers, chosen by surface: page (paper and ink) for reading and forms, night (smoke and bone) for the live map.
- Three-face type system: Pirata One title capitals, UnifrakturMaguntia blackletter heads, EB Garamond for everything else.
- One red (blood) carries every structural accent: section heads, sub-head rules, callout borders, links, focus, selection.
- Square corners everywhere. Circles appear only for resource discs, portraits and status dots.
- Rules and hairlines instead of cards. Heavy 2px ink rules open lists and tables, 1px hairlines separate rows.
- Depth exists only in the night register, where book pages sit above the map on deep ambient shadows.

## Colors

A paper-and-ink palette with a single blood red, a smoky night set for the map, and four resource colours taken from the book's tracker.

### Primary
- **Rubric Blood** (blood): the book's red. Section heads, the rule under sub-heads, rules-box borders, links, focus outlines, text selection, filled tracker marks, rank numerals, the top edge of every book page laid over the map, and primary-button hover. It is the only colour that means structure.
- **Fresh Blood** (blood-bright): the brighter red used in the night register, where the base red goes dull against black. It marks the active nav underline, the cross in the cover lockup, event-banner rules and the omen frame. On pages it is the link hover.

### Secondary
- **Ember** (ember): a firelight orange used only in the night register, for hover borders on night chips, the omen title, the "Live map" exit link in the admin masthead, and links on the empty night screen. It never appears on paper.

### Tertiary (resources)
- **Favour Amber** (favour), **Relic Red** (relics), **Supply Green** (supplies), **Territory Teal** (territories): the four campaign resources. They fill the lettered resource discs, colour the resource bars and weapon-kind marks, and wash the tracker quadrants as a faint radial bloom (12% mixed into paper). Supply Green also marks supplied outposts and success messages. Use them only to identify a resource or its direct meaning, never as decoration.

### Neutral
- **Book White** (paper): the page. The body background, and the surface of every book page, tracker box and battle tab.
- **Grey Wash** (parchment): the book's pale grey tint behind rules boxes, admin fieldsets, row hover and portrait placeholders. The token keeps its older name even though its value is now a cool grey.
- **Deep Wash** (wash-deep): the darker grey of table header rows and disabled buttons.
- **Press Ink** (ink): body text, primary buttons, heavy 2px rules and tracker box strokes.
- **Faded Ink** (ink-soft): secondary text such as ledes, sub-lines, tracker reward notes and role labels.
- **Pencil** (muted): tertiary text such as small captions, counts and empty-state lines.
- **Hairline** (rule): 1px dividers between rows, input borders and ghost-button borders.
- **Smoke Black** (night): the painted night behind the map, and the masthead band on every page-register screen.
- **Smoke** (smoke): the unlit state of the live-connection dot.
- **Bone** (bone): primary text on night. **Dim Bone** (bone-dim): inactive nav, the "Trench ✠ Crusade" line of the lockup, and unpressed toggles.

### Named Rules
**The One Red Rule.** Blood is the only structural accent on paper. If something needs emphasis on a page, it becomes red, bold or blackletter. It never gets a new colour.

**The Register Rule.** Bone, ember and fresh blood belong to the night. Paper, ink and washes belong to the page. A book page laid over the night uses page colours inside it and a single blood edge on top.

## Typography

**Title Font:** Pirata One (falls back to UnifrakturMaguntia, then serif)
**Display Font:** UnifrakturMaguntia (serif fallback)
**Body Font:** EB Garamond (Georgia fallback), loaded at 400, 400 italic, 600 and 700

**Character:** Spiky, wide-tracked capitals for chapter titles and navigation, a true blackletter in red for section heads, and a warm old-style Garamond for everything read. Body numerals are old-style. Tables, scores and counts switch to lining, tabular figures.

### Hierarchy
- **Display**: page titles. Pirata One, uppercase, tracked wide, balanced wrap. Also used, smaller, for the tracker section names.
- **Headline**: section heads, always in Rubric Blood blackletter. Book-page sheets over the map set it larger (2.1–2.2rem).
- **Title**: sub-heads. Bold Garamond capitals with a 1px blood rule directly beneath. In the current build these are uppercase, not true small caps.
- **Body**: 17px Garamond, 1.55 leading, old-style figures. Ledes cap at 60ch.
- **Label**: button text. Semibold Garamond capitals, tracked 0.08em. Table header cells use the same grammar at 0.66–0.8rem, bold.
- **Nav**: Pirata One capitals, tracked 0.1em, in the night mastheads and map chips.
- **Footer**: blackletter at 1rem, naming the current chapter at the end of a long hairline.

### Named Rules
**The Three Faces Rule.** Title capitals name places and chapters, blackletter names sections, and Garamond carries everything else. Don't add a fourth face, and don't set body copy in either display face.

**The Figures Rule.** Prose uses old-style numerals. Anything compared in a column (scores, ranks, tables, tracker counts) uses lining tabular figures.

## Layout

Page-register screens are single centred columns beside the night navigation panel. The column width follows the content: 52rem for the chronicle, 60rem for the standings ledger, 64rem for zones, player pages and admin. Every column and masthead uses the same side gutter (clamp 16px to 40px) and 28px of top padding. Grids are intrinsic: `auto-fill` / `auto-fit` columns with minimums of 15–18rem for unit cards, gazetteer entries and battle sides, and two columns for the resource quadrants of the tracker.

Lists are ruled, not boxed. A list or table opens with a 2px ink rule, rows are divided by 1px hairlines, and ledgers close with another 2px rule. The live map is full-bleed and fixed. A night band across the top carries the lockup, the map's own chips and a horizontally scrolling strip of battle tabs, and the map plate fills the rest; the navigation panel covers the map's left edge only when opened. Book-page sheets pin to the right edge (27rem, or 54rem when wide) with 14px of inset.

Breakpoints are content-driven, around 34rem, 36rem and 40rem. At phone width the sheets become bottom sheets (up to 62% of the height, 8px inset), nav chips shorten their labels, ledger columns collapse, profile tables stack label and value, and the tracker's twelve-box rows wrap to six.

## Elevation & Depth

The page register is flat. Paper sits on paper, separated by rules and washes. Depth exists only in the night register, where it describes a physical thing: a page of the book lying on top of the painted map. Those pages cast deep, soft, black ambient shadows. On paper, box-shadow appears only as a drawn line: a 1px blood ring on a selected card or pick, and the printed double inner line of a tracker box.

### Shadow Vocabulary
- **Band shadow** (`0 10px 24px rgba(0,0,0,0.45)`): the night band that carries the map's chrome.
- **Banner shadow** (`0 12px 40px rgba(0,0,0,0.55)`): event banners over the map.
- **Drawer shadow** (`0 16px 50px rgba(0,0,0,0.6)`): the standings drawer over the map.
- **Sheet shadow** (`0 20px 60px rgba(0,0,0,0.65)`): the book-page sheet over the map.
- **Selected ring** (`0 0 0 1px` blood): the selected state of a card on paper.
- **Printed box line** (`inset 0 0 0 2px` paper, then `inset 0 0 0 3px` ink): the double line inside tracker boxes.

### Named Rules
**The Page-on-Night Rule.** Only something laid over the map may cast a shadow. On paper, depth is drawn with ink.

## Shapes

Everything is square-cornered. Buttons, inputs, boxes, sheets, chips and tables all have 0 radius. Borders do the work: 1px hairlines for division, 2px ink for structure and emphasis (tracker frames, list openers, the top edge of a unit card), 3px for the first box of a tracker row, and a 2px blood edge along the top of anything laid over the map. Circles are reserved for resource discs (lettered, 1.5px ink ring), player portraits and the live dot. Small diamonds, made by rotating squares, count experience. Planned battles show a dashed top edge, and battles in play show a solid one.

The drawn marks are one-stroke SVG glyphs on a 24-unit grid (1.8 stroke, square caps, mitred joins, currentColor). The Crusade cross is a solid cross pattée.

## Components

### Buttons
Printed labels: solid, square and uppercase.
- **Shape:** square (0 radius), 1px border matching the fill.
- **Primary:** Press Ink fill, Book White label, 7px 16px padding, semibold tracked capitals.
- **Hover / Focus:** the fill and border turn Rubric Blood (0.18s on the shared ease-out curve). Focus shows a 2px blood outline offset by 2px.
- **Disabled:** Deep Wash fill with a Pencil label and a not-allowed cursor.
- **Ghost:** transparent with a Hairline border and ink label. On hover the label and border turn blood. On night mastheads the ghost uses a translucent bone border that turns ember on hover.

### Inputs / Fields
- **Style:** white field, 1px Hairline border, square, 6px 8px padding, inherited Garamond.
- **Focus:** the border turns blood with a 1px blood ring, replacing the outline. The caret and accent-colour are blood too.

### Rules Box
The book's callout, used for entry and scouted zones, battle weather, chronicle notices and admin fieldsets: a Grey Wash fill inside a 1px blood hairline, with a sub-head at the top. Admin fieldsets use the same box with a bold capital legend on paper.

### Navigation
- **Navigation panel:** one panel on the left, 17rem wide, carrying every link for player and Campaign Master alike (changed at the user's direction, 2026-09-29; it replaces the masthead and the map chip nav, which had drifted into three disagreeing lists). Smoke Black ground with a 2px blood rule down its right edge. The cover lockup sits at the top. Links are Pirata One capitals in Dim Bone that turn Bone on hover; the current page is Bone on Smoke Black with a 3px Fresh Blood edge at its left. Sections are separated by blackletter heads in Fresh Blood. It is open by default and remembered in a cookie, so the first paint is already the right width.
- **Panel handle:** a square night mark in the top-left corner, always present. It closes the panel and opens it again. Reading pages sit beside the panel; the live map, which is full-bleed, is covered by it instead, and there the panel starts closed. Below 60rem it always covers, over a scrim, and Escape closes it.
- **Cover lockup:** a small, widely tracked "Trench ✠ Crusade" line in Dim Bone with a Fresh Blood cross, above the campaign name in large Pirata One capitals.
- **Sign-in band:** the sign-in page is a full-screen backdrop (the slot for campaign-history and hero pictures; a night field until they exist) crossed by a full-width, half-transparent night band (`rgba(10, 9, 7, 0.6)`, blood hairlines top and bottom). On it, centred: the cover lockup, three Pirata One tabs (Sign in · Create account · Forgot password; the current one Bone with a Fresh Blood underline) and the chosen form in bone.
- **Map chips:** square night chips (translucent Smoke Black, bone hairline, Pirata One capitals). Hover turns the border ember. Unpressed toggles fade to Dim Bone. They now carry only what is local to the map — the weather switch, the standings toggle and the live dot — never navigation.

### Running Footer
Blackletter chapter name at the end of a full-width 1px ink hairline, closing every page-register screen and every book-page sheet.

### Book-Page Sheet
A paper page over the map: a 2px blood top edge, the sheet shadow, scrolling content, a blackletter title with the zone type set beneath it in small Pirata One capitals, a square ink close mark, and a running footer at the end. It slides in from the right on desktop and rises as a bottom sheet on phones.

### Battle Tab
A small paper page in the night band: 1px ink border, 2px blood top edge (dashed ink when the battle is only planned), overlapping portraits, and a blackletter "vs".

### Ledger and Tables
Standings rows sit between 2px ink rules. The header row is Deep Wash with bold capital labels, ranks are large blood blackletter numerals, and scores are bold lining figures. Rows wash grey on hover and the name turns blood. Profile tables follow the book: a grey header row and 1px ink rules under each body row.

### Campaign Tracker
A drawn copy of the printed tracker. Each track is a 2px ink frame with a Pirata One heading and a resource disc. Boxes are 2px ink with a printed inner line, the first box is 3px, filled boxes carry a blood stroke mark or a blood value, and each resource quadrant has a faint bloom of its colour. Resource tracks run serpentine in rows of five.

### Unit Card
A unit is a card: a 4:3 picture panel on the night ground (the unit's own picture, else its type's default set on the admin Factions page, else its initials in blackletter bone), a Leader / Elite / Mercenary ribbon in book red at the top left, and its cost in a paper medallion at the top right. Below, the book's unit entry: the name in bold capitals, the type and rank line, the grey-header profile table, kit with drawn marks, XP diamonds and italic traits. The unit's player and the Campaign Master see *Change picture / Use default* on the picture. Cards sit in a grid of about 15rem columns, two to a row on phones; the compact row version (small picture, name, cost) serves the battle panel and the aftermath.

### Faction Seal
Each faction is represented by its **struck seal**: the faction's logo rendered in Blender as a medallion (raised metal relief over a dark enamel field, metal rim, a glint light circling once per loop) with the faction's light climbing the line art from bottom to top: New Antioch gold into white; Trench Pilgrims amber into blood; Iron Sultanate alchemical violet into green on gold; Heretic Legions hellfire red into ember on dark iron; Black Grail plague murk into bile on tarnished bronze; Seven-Headed Serpent crimson into rose-gold. 32 frames, 4 s per rise, stepped in CSS (`Seal.svelte`, transform-only) and as a PixiJS AnimatedSprite on the map (faster while the warband fights). It appears as the badge on every portrait and map marker, large on the warband page and beside each side of a battle, and on the admin Factions page. The one authored moment is **ignition**: when a battlefield opens, the Aggressor's seal then the Defender's flare up once before settling into the loop. Under reduced motion each seal holds its mid-rise frame.

Seals are **the player's to colour**: they are rendered in two passes (a neutral silver medallion and a light mask) and composited in the browser (`seal-compose.ts`) with the warband's metal and its two light colours, stored per warband in Postgres. A player can also strike a seal from their own symbol on their warband page (`SealStudio.svelte`, three.js in their browser), producing the same two strips. The editor lives in a rules box on the warband page (`SealEditor.svelte`): a dark stage with the live seal, three colour wells, and the faction-seal / own-symbol choice.

The seals are built from each group's own copies of the logos (`docs/Factions/`, gitignored) by `app/scripts/fx/render_sigils.py` then `pack_sigils.py` into `app/src/lib/assets/sigils/` (also gitignored). Factions without a seal fall back to the warband's uploaded symbol with a light band in the colours of `app/src/lib/sigils.ts`.

### Warband Page (the exception)
`/warbands/<id>` follows Trench Companion's warband page on purpose (see PRODUCT.md): a left column of dark grey panels (Warband, Arsenal, Campaign — Carcass Front, Exploration), then red section bands (Elites, Troops, Mercenaries) of model rows (picture, type, custom name, kit summary, cost); a sticky right panel for the chosen model (name/type/cost/base, stat boxes, keyword chips, battlekit grouped by armoury category, the campaign fields, abilities, notes and lore). The ground is `--night` with the warband's seal enormous and out of focus, tinted by its own light. Type stays Garamond (titles in regular weight, as there), buttons use the dark red of the section bands. Every other page keeps the book.

### Warband Builder
Trench Companion's builder, in its dark register (the `.tc` class: plain-case buttons, dark panels, red bands). Everything follows the books through `lib/warband-rules.ts`, which reads its facts from the imported rules text, so a correction in Admin → Rules corrects the builder.

**"Your Warbands" (menu: Warband Builder).** Cards show:
- the seal, name and variant;
- Ducats | Glory and the number of models;
- "Carcass Front", or "No campaign connected" for a player's own list.

There are Faction, Campaign and Sort filters. Each card's ⋮ menu offers Play Mode, Print, Duplicate, "Use for the campaign" (copies a list into your campaign warband of the same faction and variant) and Delete for lists.

**The page:**
- **Summary:** Warband, Arsenal, Campaign and Exploration panels. "⚠ The warband is not valid" expands into the issues.
- **Sections:** Elites, Troops and Mercenaries bands, each with "+", and Fireteams (up to the faction's number).
- **Panels:** collapsible Faction Special Rules (the faction's and variant's rules, as printed), Notes & Lore, and Advanced Options (Remove Restrictions, Open Exploration, the strongbox).

**Adding:**
- "+" on a band opens Add Elite / Troop / Mercenary: the entries the variant allows, with picture, cost, "Active x / Max y", and "Not selectable: <reason>".
- "+" on a battlekit category opens Select Equipment: cost, warband-wide "Limit: used/max" and restrictions. Clicking an item expands its profile (range, hands, keyword chips, rule text) with "+ Add Equipment".
- Items the model cannot take stay listed, greyed, with the reason. Trench Companion gives none; we always say why.

**Menus:** ⋮ menus are native `<details>` (keyboard and no-script friendly):
- fighter: Copy, Refund, Sell, Delete;
- item: Move to a fighter or the arsenal, Copy, Sell, Refund, Delete;
- warband: Play Mode, Print, Export, Rename, Duplicate, Delete list.

**The model:**
- the profile, with the Armour characteristic following worn armour and shield;
- keywords (including those from upgrades, Fireteams and the variant's Leader);
- Upgrades as checkboxes with a warband count ("Swiss Guard · 1/4");
- battlekit by the seven armoury categories;
- Campaign: Experience, Battle Scars, Advancements, Fighter Status, and Fighter Rank (Promote/Demote);
- abilities and lore.

**Play Mode** (`/warbands/<id>/play`) is a card per model: profile, weapons with range, type, keywords and rules, kit and abilities, with trackers kept on the device (Blood Markers, Down, Out, grenades used). **Print** is a book-page roster sheet.

### New Warband
`/warbands/new` is Trench Companion's two-step creation in the warband page's dark look. **Select Faction**: one wide card per faction, with its animated seal large on smoke lit from below in the faction's own light, the name in Pirata, and, when the CM has set unit art, the leader's picture fading in from the right. Variants hang beneath as indented rows with a small seal; the chosen one gets a left rule in the faction's high colour. **Details**: name, Entry Zone, starting Ducats (700) and Glory, and Remove Restrictions, then a dark red Create Warband. The steps are one form of radio cards, so it works without script; with script, the list folds to the chosen card and the details scroll into view.

### Battlefield
**Active mode.** Clicking a zone with a battle in progress (or *Enter the battle* on its panel) opens `/?battle=<game>`, a shareable URL the TV can sit on. The camera flies in to 2.2×, a vignette closes round the field, and a HUD sets the scene:
- a "Battle joined" stamp in Pirata on dark red, slammed in by anime.js, then settling at −3°;
- the two sides' plaques low left and right;
- *Leave the battlefield* (or Esc) to go back.

On the field, the two sides (standing out to either side of the zone, clear of the warbands' markers) trade small-arms fire. There are no drawn tracer lines:
- **Machine-gun bursts:** a run of pinpoint muzzle flashes, then dirt kicked up where the rounds walk across the other side.
- **Rifle volleys:** staggered flashes along a firing line, with grey powder smoke left hanging.

Artillery comes in between. Each shell drops out of the sky on a short arc with a thin grey trail. It lands in an additive white-hot flash, throws up a plume of earth whose clods rain back on ballistic arcs, rings the ground with a pale shockwave, and leaves low dust, a smoke column leaning with the wind and a scorched crater that fades over several seconds. Other battles on the map keep a quieter version of the same.

Every screen sees the same battle. The stream sends the server's clock, time is cut into 0.35 s slots, and each slot's events are rolled from the battle's seed and the slot number. So the TV and every phone see each shell land at the same moment, in the same place, with the same character. Each shell rolls its own:
- approach arc and flight time;
- plume size, mirroring, speed and tilt;
- flash colour and size;
- shockwave (none, now and then, on soft ground);
- crater size;
- dust and smoke shade and height.

Now and then a salvo of two or three walks across one side's ground.

**The result.** When the Campaign Master records a result, every open screen plays it, driven by one anime.js timeline:
1. A barrage scaled to the margin, walking onto the loser's ground while the winner's guns open up. Hard-fought: two shells. Decisive: four. Crushing: seven, with crows.
2. The fallen drop where their side stood, tinted slightly towards that side's light.
3. The winner's monument rises out of the mud on their side, shaking the ground.
4. The loser's broken standard, dyed in their colours, drops onto it.
5. The result line lands at the bottom ("Heretic Legions triumph at Syrian Gate").

A draw raises a cairn. With reduced motion, only the final state shows.

**Monuments.** Every won battle leaves its monument on the zone, in a cluster to the lower-left, clear of the markers, over a field of the fallen. The newest five stand, the newest largest; older ones are darker and smaller; beyond five they heap into a cairn with a count. The monuments by faction:

| Faction | Monument |
| --- | --- |
| New Antioch | iron cross and torn banner |
| Trench Pilgrims | reliquary shrine with candles |
| Iron Sultanate | brass obelisk with an alchemical orb |
| Heretic Legions | inverted cross hung with chains |
| Black Grail | grail pillar in a fly swarm |
| Court of the Seven-Headed Serpent | seven-headed serpent pillar |
| Procession of the Sacred Affliction | gibbet with cage and bells |
| Heretic Naval Raiders | anchor, mast and black sail |

All are rendered in Blender (`scripts/fx/render_fx.py`: `monuments`, `trophy`, `corpses`, `flash`, `blast`, `spurt`) with the outposts' camera and light, so they sit on the painted map.

### Sky (live map)
- **Clouds.** Map-wide rain, storms and blood rain are clouds, not a curtain over the screen: soft cells drift across the map on the wind, over the map art but under the tokens, with a shadow on the ground.
  - Some only pass over. Others rain for a stretch of their crossing, with thin slanted streaks and splash rings beneath them.
  - Thunderheads are darker and strike lightning where they are.
  - Each cell is seeded from its slot on the server's clock, so every screen sees the same sky.
- **Light of the hour.** Day, dawn, dusk, night and blood moon are a multiply grade over the map, which keeps the art's colours. After dark, lanterns glow at every outpost and battle.
  - *Day cycle* runs day → dusk → night → dawn over a length the Campaign Master sets (default 30 minutes), at the same moment on every screen.
- **The UI stays readable.** Markers, labels and the page's own UI always sit above the weather.

### Compendium
The rules text (core rules, campaign, scenarios) reads as the book: a column of Garamond under a Pirata title, blood-red sub-heads, ✠ bullets, tables ruled in ink, keywords in capitals underlined with dots and linked to the glossary, and a sticky contents rail for the book on the right (stacked below on phones).

Rulebook pages: unit entries as boxes with a blood-red name bar (blackletter), cost and availability, the profile as five boxed values, keyword chips that show their glossary text on hover or tap, and folding Abilities / Battlekit / Lore; armoury tables with grey header rows.

### Map Studio
The admin register, widened for work.
- **Layout.** The map uses the screen's width (not the reading column), with the zone panel to its right on desktop and below it on phones.
- **Tools.** Move, Link and Add are joined square toggles showing their keys (M, L, A). One hint line says what the chosen tool does, and in Link mode which zone you are linking from.
- **Once-per-campaign actions.** Uploading the image, zone files and the Carcass Front preset sit apart in a folded "Map image and zone files" section. Every action that replaces the map asks first and names what it will replace.
- **Zones.** Discs coloured as on the live map: ink for entry zones, blood red for special, bone for basic.
  - Every disc has a 44 px target, whatever the map's size on screen.
  - With a map image, only the selected zone, its neighbours and the house zones are labelled, because the image prints the rest.
  - The selected zone has a gold ring and its neighbours a pale red one. Keyboard focus is a dashed blood ring, distinct from selection.
- **Panel.** A zone opens under an "All zones" back link; Escape also goes back. Moving between the list and a zone moves focus with it.
- **Unsaved work.** A save bar rises from the bottom edge (2px blood top edge, the sheet shadow) with the number of unsaved changes, *Discard changes* and *Save the map* (Ctrl S). Leaving the page with unsaved changes asks first.
- **Live map without an image.** A plain parchment field inside a thin red frame, with every zone drawn the way house zones are.

### Faction Studio
An admin register page like *Rules*:
- **Layout.** A faction header with its seal, then text tabs underlined in blood red (Identity, Rules, Units, Armoury, Keywords, Template), and entries as folding rows with their forms in an auto-fill grid.
- **Entry tags.** Authored entries are tagged *yours*; edited book entries are tagged *house rule* and offer *Revert to book*.
- **Forms.** Stipulations are plain checkboxes. Names are typed with datalist suggestions from the faction's units, its armoury and the glossary.
- **Errors.** Shown by the path of the key in the template (`units[2].category must be one of …`), so the YAML and the forms read the same.

## Do's and Don'ts

### Do:
- **Do** choose the register by surface: rulebook page for anything read or filled in, painted night only around the live map.
- **Do** use Rubric Blood (#a3170f) for every structural accent on paper, and Fresh Blood (#c8231a) or Ember (#e0692a) for accents on night.
- **Do** open lists and tables with a 2px ink rule and divide rows with 1px hairlines instead of wrapping them in cards.
- **Do** end every page-register screen and book-page sheet with the blackletter running footer.
- **Do** draw new glyphs as single-stroke SVG marks on the 24-unit grid (1.8 stroke, square caps), coloured with currentColor.
- **Do** switch to lining tabular figures wherever numbers are compared.

### Don't:
- **Don't** use the cream-parchment fantasy look, or let a dark dashboard's habits (cards, fills, elevation, rounded chrome) onto UI surfaces. Paper is white. The dark surfaces are the night register and the navigation panel, which is night by the same rule as the masthead it replaced.
- **Don't** round rectangles. Radius is 0 everywhere, and circles are only for discs, portraits and dots.
- **Don't** put drop or ambient shadows on page-register surfaces. On paper, box-shadow is only a 1px ring or a printed inner line.
- **Don't** introduce new hues on paper. The resource colours are the only non-red hues, used for resources and their established extensions (unit kit marks, glory cost, supplied or OK).
- **Don't** set body copy in Pirata One or blackletter, and don't add a fourth typeface.
- **Don't** use icon fonts, emoji or text glyphs as icons. Draw a Mark.
