# Claude Design — redesign / extension prompt

Paste the block below into [claude.ai/design](https://claude.ai/design) to iterate on the
Forgotten Letters UI. It keeps the established design language, raises UI/UX polish,
designs the missing surfaces, and adds the monetization UI the open-source model needs.

Adjust the "Focus for this pass" line to scope each session (the surface list is large —
do it in batches).

---

```
You are continuing the design of "Forgotten Letters" — a free, open-source community
archive for tabletop wargame scenarios, campaigns, and warbands (starting with Trench
Crusade). There is an existing design bundle; honor and extend it, don't restart.

NON-NEGOTIABLE — keep the established design system:
- Aesthetic: grimdark / WWI-meets-hellscape. "A trench is mostly mud; the gilding is rare."
- Use ONLY the 16-token palette, numbered 01–16, grouped Surfaces (01–05) / Text (06–08) /
  Accent (09–12) / Action (13–16):
  01 Charcoal #0C0C0E · 02 Ash #1A1A1F · 03 Smoke #252529 · 04 Trench Gray #2E2E35 ·
  05 Trench Hi #3A3A42 · 06 Bone #E8E2D6 · 07 Dust #9B9484 · 08 Iron #5C574E ·
  09 Tarnished Gold #B8923F · 10 Aged Brass #8A6D2F · 11 Blood Red #8B1A1A ·
  12 Crimson #A52222 · 13 Verdigris #2D6B4F · 14 Mustard #B8860B · 15 Flare Red #C0392B ·
  16 Steel Blue #4A6FA5.
- Respect the ratio contract: Surfaces ~60% / Text ~18% / Accent ~8% / Action ~8%. Never
  let gold (09) exceed ~10% of a screen. Accent and action colors are spotlights only.
- Forbidden pairings: 11+15, 09+14, 11+14, 08+01, 06+09, 13+16. Blessed: 06-on-01,
  09-on-02, 06-on-11.
- Type: Cinzel (display/headings/numerals), Inter (body/UI), JetBrains Mono (stats, codes,
  kickers). Grain overlay ONLY on hero/auth/error backgrounds. Lucide-style stroke icons.
- Original brand mark (envelope/wax-seal sigil). No real publisher IP — Trench Crusade,
  faction names, and unit stats are placeholders to be licensed/swapped later.

GOALS FOR THIS WORK:
1. Raise UI/UX polish on existing surfaces (Landing, Auth, Scenarios browser + editor,
   Campaigns browser + graph + lobby, Warband builder v2 + browser + detail, Rules,
   Compendium, Profile, Settings, Pricing/FAQ/Legal, Quick Drawer, AI Forge): tighten
   hierarchy, spacing, empty/loading/error states, focus states, and mobile parity for the
   heavy desktop-only surfaces (warband builder, scenario detail, campaign lobby).

2. Design the MISSING surfaces:
   - Play loop: live Battle Tracker (turn counter, blood markers, dice helper, timeline
     log), Post-battle Report, Warband post-battle resolution (injuries/XP/loot/payout).
   - Social: Notifications inbox, reusable Comments/Activity feed, News/Dispatches feed,
     Contact form.
   - Funnel/account: Onboarding (pick faction → name first warband → tour), Empty states
     for every index, Email verification, Password reset-with-token, 2FA setup + challenge,
     Billing management (entry to manage/cancel a supporter subscription), Delete-account
     confirmation.
   - Admin: Moderation queue (reported content + flagged AI Forge output), User admin
     (search/suspend/roles), Audit log.

3. Add MONETIZATION UI as first-class components (this project is funded by ads + optional
   supporter tiers; community content is never paywalled):
   - Unobtrusive Ad Slot component for browse rails / between list pages ONLY — never inside
     the map editor, warband builder, battle tracker, or AI Forge. It must render nothing
     for supporters.
   - Cookie-consent banner (gates the AdSense fallback; privacy-friendly ads need no
     consent).
   - Upsell dialog shown at quota boundaries (storage full, warband/scenario limit, private
     campaign, out of Forge credits) — informative, never nagging.
   - Supporter badge, and a "Support the archive" surface combining Stripe tiers
     (Conscript free / Veteran / Cartographer) with GitHub Sponsors + Ko-fi donation links.
   - Reflect tiers in the existing Pricing design: Conscript (free, ads shown, 50 MB),
     Veteran (ads off, 5 GB, private campaigns, Forge credits), Cartographer (50 GB, API,
     co-author, priority).

Deliver as labeled artboards grouped by surface, desktop + mobile where it matters. Keep
accessibility: 44px+ touch targets, visible focus, sufficient contrast (respect the
forbidden pairings).

Focus for this pass: <<EDIT ME — e.g. "the play loop: Battle Tracker + Post-battle Report
+ Warband resolution, desktop and mobile">>
```

---

## Tips

- **Batch it.** The surface list is big; set "Focus for this pass" to 2–4 related screens
  per session for higher-quality output.
- **Reference the audit.** [`UI-Surfaces.md`](UI-Surfaces.md) lists every existing and
  missing surface with priorities — point Claude Design at the next priority bucket.
- **Keep the contract testable.** After each pass, sanity-check against
  [`DesignSystem.md`](DesignSystem.md): is gold under ~10%? Any forbidden pairings? Grain
  only on hero/auth/error?
- **Export and hand off.** When happy, export the bundle and run a coding session against
  it to implement the surfaces per [`UI-Surfaces.md`](UI-Surfaces.md).
