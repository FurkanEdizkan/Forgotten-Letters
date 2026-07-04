# Sprint 6 — Social, Notifications, Reports

> Goal: turn the platform into a community — voting, comments, favorites,
> sharing, public profiles, **plus the notification + email infrastructure
> that all of those features need**, plus the user-facing report system.
>
> Phases included: **6, E, F4, H4, N1, N2** (N1, N2 are gap-closing phases —
> see `00-master-plan.md`).

---

## Phase N1 — Email / Transactional service

### N1.1 Vendor

- [ ] Create Resend account (free tier: 3k/mo, 100/day) — locked decision per master plan
- [ ] Verify sending domain (forgotten-letters.com) — SPF/DKIM/DMARC
- [ ] Add `RESEND_API_KEY` to `.env.local` and Vercel envs
- [ ] `npm i resend react-email @react-email/components`

### N1.2 Templates

- [ ] `src/emails/Layout.tsx` — branded shell using grimdark palette (inline-friendly CSS)
- [ ] `src/emails/Welcome.tsx`
- [ ] `src/emails/PasswordReset.tsx` (replaces Supabase default; configure custom email template URL → our endpoint)
- [ ] `src/emails/EmailConfirmation.tsx`
- [ ] `src/emails/Notification.tsx` — generic shell for digest/single notifications
- [ ] `src/emails/ReportStatusUpdate.tsx`
- [ ] `src/emails/AccountBanned.tsx`
- [ ] `src/emails/DataExportReady.tsx`

### N1.3 Sending wrapper

- [ ] `src/lib/email/send.ts` — `sendEmail({ to, template, props })` using Resend SDK
- [ ] Renders React Email templates → HTML + plaintext fallback
- [ ] All sends are async (do not block server actions); enqueue via Supabase queue table or fire-and-forget with structured logging
- [ ] Bounce/complaint webhook: `src/app/api/email/webhooks/route.ts` — verifies signature, marks `profiles.email_status`

### N1.4 Supabase auth template overrides

- [ ] In Supabase dashboard → Auth → Email Templates, point each template at `{{ .SiteURL }}/api/auth/email-template/<type>` (or use Resend SMTP). Pick one; default to **Resend SMTP** in Supabase Auth settings to keep auth and product email on the same domain reputation.

### N1.5 Verify

- [ ] Register → welcome email arrives, branded
- [ ] Forgot password → branded reset email arrives
- [ ] Bounce on a fake address marks `email_status = 'bounced'`

---

## Phase N2 — Notifications

### N2.1 Migration `016_create_notifications.sql`

- [ ] `notifications` table: id, user_id (recipient), type text CHECK in (`comment_reply`, `new_comment_on_scenario`, `new_vote`, `match_logged_against_warband`, `report_resolved`, `report_dismissed`, `account_banned`, `account_unbanned`, `data_export_ready`, `welcome`), actor_id NULL, target_type, target_id, payload jsonb, is_read default false, created_at
- [ ] `notification_preferences` table: user_id PK, plus a boolean per type for `in_app` and `email`
- [ ] Index `notifications(user_id, is_read, created_at DESC)`
- [ ] Realtime publication includes the table

### N2.2 Producer hooks

- [ ] In each relevant server action, after the primary operation, INSERT a notification row (and respect prefs)
- [ ] List of producers:
  - new comment on scenario → notify scenario author
  - reply to comment → notify parent comment author
  - new upvote on scenario/warband → notify owner (rate-limited: max 1 vote-notification per recipient per hour to avoid spam)
  - match logged with `opponent_warband_id` set → notify opponent owner
  - report resolved/dismissed → notify reporter (Sprint 7 admin actions)
  - account banned/unbanned → notify user
  - data export ready (U1) → notify user

### N2.3 Email fan-out

- [ ] Edge function or DB trigger on `notifications` INSERT → if `notification_preferences.<type>.email = true` AND `email_status != 'bounced'` → enqueue email send via N1
- [ ] Daily digest cron `0 13 * * *` UTC for low-priority types (votes, favorites) — collapses multiple events

### N2.4 In-app UI

- [ ] `src/components/notifications/NotificationBell.tsx` — unread badge, opens a popover
- [ ] `src/components/notifications/NotificationList.tsx` — list with mark-as-read on hover; "Mark all read"
- [ ] Realtime subscription via `supabase.channel('notifications:user_id=eq.{id}')`
- [ ] `src/app/(protected)/settings/notifications/page.tsx` — pref matrix per type (in-app + email checkboxes)

### N2.5 Verify

- [ ] User A comments on user B's scenario → bell badge appears for B in real time and an email is sent (if pref enabled)
- [ ] Disabling email pref for the type stops emails but keeps in-app
- [ ] Spam-vote test: 10 votes from different users on the same scenario in 5 min → at most one notification email per recipient per hour

---

## Phase 6 — Voting, Comments, Favorites, Share, Profiles

### 6.1 Voting

- [ ] `src/components/social/VoteButtons.tsx` — optimistic
- [ ] `toggleVote(target_type, target_id, value)` in `src/lib/actions/social.ts`
- [ ] Net vote count on cards/pages

### 6.2 Favorites

- [ ] `src/components/social/FavoriteButton.tsx`
- [ ] `toggleFavorite`, `getFavorites`
- [ ] `src/app/(protected)/profile/favorites/page.tsx`

### 6.3 Comments

- [ ] `src/components/social/CommentThread.tsx` — top-level + one level of replies
- [ ] `src/components/social/CommentForm.tsx` — markdown textarea (S1 pipeline)
- [ ] `createComment`, `deleteComment`, `getComments`
- [ ] Render on scenario + campaign view pages
- [ ] **Realtime**: subscribe to `comments` for the open page; new comments slide in
- [ ] Edit window: 5 minutes after post, then locked

### 6.4 Share

- [ ] `ShareButton.tsx` — Copy link
- [ ] `generateMetadata()` adds OG image (use scenario thumbnail, fallback to default)
- [ ] Verify previews on Discord + Twitter

### 6.5 Public profiles

- [ ] `src/app/(public)/user/[username]/page.tsx` — bio, avatar, joined, totals
- [ ] List published campaigns + scenarios + public warbands
- [ ] Print-friendly CSS for warband rosters (`@media print`)

---

## Phase E — Warband polish & integration (parallel)

- [ ] "Warbands" link in Navbar
- [ ] Warband count surfaced in account dashboard (Sprint 7 wiring)
- [ ] Public warband browse page polished (`/warbands?…`)
- [ ] Add ReportButton to warband cards (uses F4)

---

## Phase F4 — User-facing reports

- [ ] `src/components/social/ReportButton.tsx` — flag icon
- [ ] `src/components/social/ReportModal.tsx` — reason radio + details (max 500 chars)
- [ ] `submitReport` server action with duplicate check
- [ ] Mount on scenario cards, comment threads, warband views, profiles
- [ ] "Already reported" state when applicable

---

## Phase H4 — Performance & caching

- [ ] ISR `revalidate` per page (60s home, 300s detail)
- [ ] `<Link prefetch>` for likely next pages
- [ ] Lazy-load images with `next/image`
- [ ] Cursor pagination on browse routes
- [ ] Verify Konva + Tiptap dynamic-imported (chunk only on edit pages)

---

## Sprint 6 — Verify

- [ ] Comment on a scenario → author gets in-app + email notification (if opted in)
- [ ] Favorite/unfavorite cycle works and persists
- [ ] Vote spam → throttled
- [ ] Report a comment → admin queue receives it (admin UI in Sprint 7)
- [ ] OG preview renders on a Discord paste
- [ ] Lighthouse performance ≥ 80 on a scenario detail page
