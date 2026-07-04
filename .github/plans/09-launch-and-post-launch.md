# Sprint 9 — Launch & Post-Launch (v2 backlog)

> Goal: cut over to production with confidence and capture every deferred
> idea so v2 planning has a clean starting point.

---

## Launch checklist

### Pre-cutover

- [ ] All Sprints 1–8 verify-blocks signed off
- [ ] Production Supabase project on **Pro** plan (PITR backups)
- [ ] Custom domain pointed at Vercel; SSL active
- [ ] Resend domain verified; deliverability tested to Gmail, Outlook, ProtonMail
- [ ] Sanity production dataset locked (no `staging`-only refs)
- [ ] Sentry production DSN, source maps uploaded
- [ ] UptimeRobot monitoring enabled
- [ ] Bootstrap admin: promote initial user via `supabase/seed/002_admin_user.sql` keyed on `INITIAL_ADMIN_EMAIL`
- [ ] Sentinel "Deleted user" profile inserted (id `00000000-0000-0000-0000-000000000000`)
- [ ] Demo content in Sanity: 1 rules page, 2 official scenarios, 1 news post
- [ ] Demo content in Supabase: 2 published example scenarios (admin-authored), 1 example public warband
- [ ] Legal pages (Terms, Privacy, DMCA, Cookies) finalised in Sanity

### Cutover

- [ ] Disable preview password protection on production
- [ ] Announce on Trench Crusade community channels (Discord, Reddit r/TrenchCrusade)
- [ ] Tag release `v1.0.0`; semantic-release publishes changelog

### Post-cutover (first 72h)

- [ ] Monitor Sentry error rate hourly
- [ ] Monitor Supabase auth/storage/db usage daily
- [ ] Triage incoming reports + feedback within 24h
- [ ] Hotfix any P0 bug via `hotfix/*` branch from `main`

---

## v2 Backlog (deferred)

These came from the original prompts and the gap review. They are explicitly
**out of V1**.

### Features

- [ ] Premium tier with Stripe (storage upgrade, vanity badges, watermark removal)
- [ ] Real-time collaboration on map editor (Supabase Realtime cursors)
- [ ] Scenario versioning / edit history
- [ ] Push / web-push notifications
- [ ] Scenario PDF export (warband PDF already in V1)
- [ ] Campaign play tracker session log (multi-session campaigns)
- [ ] Campaign Groups (GM-led shared campaigns)
- [ ] Warband import/export JSON (BattleScribe-style)
- [ ] Stat comparison tool for unit/equipment optimisation
- [ ] Visual regression testing (Playwright screenshots)
- [ ] Lighthouse CI performance budgets
- [ ] Canary deploys via Vercel
- [ ] Load testing (k6/Artillery) when approaching 500 users
- [ ] IP-level bans
- [ ] Mod queue for first-time content from new accounts
- [ ] Auto-moderation keyword scanner
- [ ] Email digest preferences (weekly summary)
- [ ] Storybook for component library
- [ ] Multi-language support (i18n) — German, French, Spanish first
- [ ] Theme variants per game system (when 2nd system added)
- [ ] Image lightbox / fullscreen viewer
- [ ] Map editor: measurement tool, mirror, layer locking improvements
- [ ] Global keyboard shortcuts (`/` for search, `g h` home)
- [ ] Appeal system for banned users
- [ ] Scheduled featuring (rotation queue, auto-unfeature after N days)
- [ ] Scenario fork tree visualisation

### Process

- [ ] Add additional game systems beyond Trench Crusade
- [ ] Open-source contribution guide (CONTRIBUTING.md)
- [ ] Public roadmap page

---

## How to plan v2

1. Re-run the gap-analysis exercise on the live product after 90 days.
2. Promote items from this backlog into a new master plan
   (`.github/plans/v2/00-master-plan.md`).
3. Keep V1 plans frozen here as a historical record.
