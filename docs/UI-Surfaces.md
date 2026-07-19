# UI Surfaces

The Claude Design bundle (18 prototype components under `project/components/`) is the UI
source of truth. This maps each prototype to its App Router destination and build priority,
and lists the surfaces the design assistant itself flagged as still missing.

The prototypes are self-contained React/Babel files using inline styles and a shared
`window.FL` / `window.I` token API. **Recreate the visual output** in real Next.js +
Tailwind (themed from [`DesignSystem.md`](DesignSystem.md)); don't port the prototype's
internal structure verbatim.

## Designed surfaces → routes

| #   | Prototype             | Surface(s)                                                                        | Route(s)                                         | Priority |
| --- | --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ | -------- |
| 1   | `tokens.jsx`          | Design tokens + icon set (foundation, not a page)                                 | — (theme)                                        | **P0**   |
| 2   | `Chrome.jsx`          | Navbar (logged-out/in/admin/mobile) + Footer                                      | root layout                                      | **P0**   |
| 3   | `Landing.jsx`         | Landing (desktop + mobile)                                                        | `/`                                              | **P0**   |
| 4   | `Auth.jsx`            | Login, Enlist (register), Forgot password                                         | `/(auth)/login`, `/register`, `/forgot-password` | **P0**   |
| 5   | `Scenarios.jsx`       | Scenarios browser: featured, favorites, collections, archive                      | `/scenarios`                                     | **P1**   |
| 6   | `ScenarioEditor.jsx`  | Scenario editor: map canvas, tools, inspector (Map/Scenario/Story/Campaign/Rules) | `/scenarios/new`, `/scenarios/[slug]/edit`       | **P1**   |
| 7   | `Campaigns.jsx`       | Campaigns browser + create wizard + node graph editor                             | `/campaigns`, `/campaigns/new`                   | **P1**   |
| 8   | `Campaign.jsx`        | Campaign detail / lobby                                                           | `/campaigns/[slug]`                              | **P1**   |
| 9   | `WarbandsBrowser.jsx` | Warbands browser **and** warband public detail + fighter panel                    | `/warbands`, `/warbands/[id]`                    | **P1**   |
| 10  | `WarbandV2.jsx`       | Faction picker, warband builder, recruit modal                                    | `/warbands/new`, `/warbands/[id]/edit`           | **P1**   |
| 11  | `Rules.jsx`           | Rules viewer with version selector                                                | `/rules`, `/rules/[slug]`                        | **P2**   |
| 12  | `Compendium.jsx`      | Compendium / core-rules reader                                                    | `/rules/compendium/[slug]`                       | **P2**   |
| 13  | `Profile.jsx`         | Public profile: career, match history, campaigns, activity                        | `/user/[username]`                               | **P2**   |
| 14  | `Settings.jsx`        | User settings (Profile/Account/Notifications/Storage/Privacy) + admin settings    | `/settings/*`, `/admin/settings`                 | **P2**   |
| 15  | `Marketing.jsx`       | Pricing, FAQ, Legal                                                               | `/pricing`, `/faq`, `/legal`                     | **P2**   |
| 16  | `QuickDrawer.jsx`     | Global quick-access side drawer                                                   | global (layout)                                  | **P2**   |
| 17  | `Forge.jsx`           | AI Forge workspace (weapon swap → variants → STL)                                 | `/forge`                                         | **P3**   |
| 18  | `DesignSystem.jsx`    | Internal design-system / color reference page                                     | `/design` (internal)                             | **P3**   |

Priority legend: **P0** foundation (theme + chrome + landing + auth), **P1** core product
loops (browse + create scenarios/campaigns/warbands), **P2** social + content + account,
**P3** advanced + internal.

## Missing surfaces (design "next" — flagged in the design audit)

The design assistant's own coverage audit identified these gaps. They should be designed
(via the prompt in [`ClaudeDesign-Prompt.md`](ClaudeDesign-Prompt.md)) before/with the
build:

**Play loop**

- Live **battle tracker** (turn counter, blood markers, dice helper, timeline log)
- **Post-battle report** (casualties, glory awarded)
- Warband **post-battle resolution** (injuries, XP, equipment, ducat payout)

**Social fabric**

- **Notifications inbox** (settings exist; the inbox screen does not)
- General **comments / activity feed** component
- **News / dispatches** feed (landing teases it; no full page)
- **Contact** form

**Funnel & account-critical**

- **Onboarding** (post-enlist: pick faction → name first warband → tour)
- **Empty states** for every index
- **Email verification** screen + **password reset _with token_**
- **2FA** setup + challenge
- **Billing management** (upgrade/manage/cancel — Stripe Customer Portal entry)
- **Delete-account** confirmation flow

**Admin**

- **Moderation queue** (reported content + flagged AI Forge output)
- **User admin** (search, suspend, roles) + **audit log**

**Monetization (new — not in original design)**

- **Ad slots** as first-class components, **cookie-consent banner**, **upsell dialogs**,
  **supporter badge** — see [`Monetization.md`](Monetization.md)

**Cross-cutting**

- **Mobile parity** for the heavy desktop-only surfaces (warband builder, scenario detail,
  campaign lobby, battle tracker)
- Footer stubs: API docs, Changelog, Status, About/Press, Search results
