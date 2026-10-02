---
target: the live map (desktop, phone, TV)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/mnt/Storage/All/Develop/Trench Crusade - Forgotten Letters/app/src/routes/(public)/+page.svelte"
target_fingerprint: "sha256:c46efeacd007f1d5cd858739afb56b19e49c959a750f006dd44b69962aa7bf1e"
target_path: /mnt/Storage/All/Develop/Trench Crusade - Forgotten Letters/app/src/routes/(public)/+page.svelte
timestamp: 2026-10-01T15-37-41Z
slug: app-src-routes-public-page-svelte
---
# Live map critique (desktop, phone, TV)

Score 25/40 (Acceptable). Heuristics: status 2, real world 4, control 2, consistency 3, error prevention 3, recognition 2, efficiency 3, minimalism 2, recovery 2, help 2.

Specificity: strongly authored (book sheets on the painted night, paper battle tabs, stamp, seals). Slips in scale and empty states. Detector: CLI 0; browser 19 desktop / 2 phone, almost all false positives (seal crop, sprite flipbook); real: lockup kicker 10.6px desktop / 9px phone.

Priority issues:
- [P1] Nothing scales up for the TV: chrome is desktop-sized at 1920x1080 (tab sub-lines 11.7px, standings 13.6px, brief 13.6px, live dot 9px). Fix: room-scale type above ~100rem or ?tv mode; label the live dot. adapt, typeset.
- [P2] The map never rests: Pixi redraws every frame even with reduced motion; 16 seals = 60 style recalcs/s; 1.56 MB faction art on home; ~2.3 MB blob seal strips; draw() rebuilds six layers per snapshot; antialias on. Phone at 4x CPU: first draw 1.6-2.0 s, 12 long tasks. Fix: idle the ticker, quality tiers, lazy art, in-place updates, no MSAA on low-end. optimize.
- [P2] Chrome covers the map: dock over the art with empty night on the left; stamp and brief over the aggressor's banner; full-height empty side columns. Fix: fit map beside the dock; brief to bottom centre; columns shrink, authored empty line. layout.
- [P2] Missing exits on the home map: Esc only in battles; phone drawer has no close; no aria-expanded; no focus move into sheets. harden.
- [P2] Phone loses the battle brief (dice, deployment/victory, outposts, regional weather). clarify.

Personas: TV watcher 3 m away can't read tabs, standings sub-lines or brief; Casey on phone: no pan hint, cut-off tab strip, no drawer close, 62% sheet hides tapped zone; Jordan: blank discs, "rd 3 · 2/8", dashed vs solid tabs; Sam: canvas-only zones, colour-only live dot.

Minor: CM handle clips lockup on phone; ad-hoc colours (#8f1f18, #b3261e, #95b54c, #d98c80, #e8d9c0); Omens column misaligns detail tables; sky chip names the action not the state; guest markers show portraits vs seals in the dock; "none yet" under OUTPOSTS; 18-item CM nav.
