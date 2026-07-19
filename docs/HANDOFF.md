# Handoff — where things stand and what to do next

Written 2026-07-19. Branch: `chore/local-dev-foundation` (21 commits, unmerged).

Read this first if you are picking the project up cold. It records what
is done, what is deliberately _not_ done, and the order to tackle what
remains.

---

## 0. Do these three things first

They take under an hour and two of them are blocking everything else.

### 0.1 Open the PR — CI has never run

Twenty-one commits sit on `chore/local-dev-foundation` and
`.github/workflows/ci.yml` has **never executed**. It was written and
its steps verified locally, but the service-container config (Postgres,
MinIO, Mailpit), the gitleaks scan, and the Docker build job are
unproven. This is the single largest unverified thing in the repo.

```bash
gh pr create --fill
```

Expect to fix something. Likely candidates: the MinIO health check
(`mc ready local` needs the `mc` binary in the image — the `bitnami/minio`
image is used for this reason), and `db:migrate` running before the
Postgres service is fully ready despite the health check.

### 0.2 Get the local stack running

```bash
cp .env.example .env.local          # defaults target the local stack as-is
docker compose -f .devcontainer/docker-compose.yml up -d db minio minio-init mailpit
npm ci
npm run db:migrate
npm run db:seed                     # required: integration tests need the game system
npm run dev
```

Then check <http://localhost:3000/api/health> — it must report
`database`, `storage`, and `mail` all true. If any is false, the app is
fine and a container is not.

### 0.3 Fix `docs/UI-Surfaces.md`

It names an 18-prototype bundle under `project/components/` as "the UI
source of truth". **That bundle does not exist** — not in the repo, not
in git history, not on the filesystem, and not in the linked Claude
Design project (which contains only the 9 UI primitives already in
`src/components/ui`). Either restore the bundle or annotate the doc, or
the next person loses the same time to it.

---

## 1. What is actually done

All of the below is verified against the running stack, not just written.

| Phase                     | Status      | Notes                                                                                           |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| 0 — local foundation      | Complete    | compose stack, prod image, CI config, gates                                                     |
| 1 — auth                  | Complete    | email+password, reset, session-aware chrome. **OAuth untested** — needs real Google/GitHub apps |
| 2 — schema + storage      | Complete    | 17 tables, quota accounting, presigned uploads                                                  |
| 3 — MDX content           | Complete    | rules with directory-driven versioning, official, legal, FAQ                                    |
| 4 — scenarios & campaigns | Mostly      | CRUD, editors, browse, detail. **Graph canvas not built**                                       |
| 7 — social                | Mostly      | votes, favorites, comments, profiles, notifications. **Battle tracker not built**               |
| 8 — account               | Partly      | settings, storage dashboard, avatars, 2FA primitives. **2FA UI, Forge not built**               |
| 5 — map editor            | Not started | blocked, see §3                                                                                 |
| 6 — warbands              | Not started | blocked, see §3                                                                                 |
| 9 — monetization          | Not started | blocked, see §3                                                                                 |
| 10 — hosting              | Not started | blocked, see §3                                                                                 |

Test suite: **116 unit/integration + 69 e2e**, all passing.
Run with `npm test` and `npm run test:e2e` (both need the stack up).

---

## 2. Next steps, in order

Each of these is unblocked and can be picked up immediately.

### 2.1 Finish 2FA (Phase 8) — ~half a day

The crypto layer is built and tested (`src/lib/auth/totp.ts`, 15 tests).
The schema columns exist. What remains:

1. **Enrolment UI** at `/settings/account`:
   - call `generateSecret()`, store it on the user, render
     `buildOtpAuthUrl()` as a QR (the `qrcode` package is installed)
   - require a valid code via `verifyCode()` before setting
     `totpConfirmedAt` — enrolment is deliberately two-phase, do not
     enable on generation
   - show `generateRecoveryCodes().plaintext` **once**, store the hashes
2. **Login challenge**: after a correct password, if
   `totpConfirmedAt` is set, require a code before issuing the session.
   This is the fiddly part — Auth.js Credentials `authorize()` must
   either accept the code in the same submit, or a second step is needed.
   The simpler route is a `totp` field on the credentials provider.
3. **Disable flow**: require a current code or a recovery code.
4. Tests: enrolment round-trip, login blocked without a code, recovery
   code works once.

### 2.2 Battle tracker (Phase 7) — ~1 day

Needs one product decision from the owner: **what a battle result
records**. A minimal, defensible shape:

```
battles: id, campaignId, scenarioId, playedAt, notes
battle_participants: battleId, userId, warbandId?, result (win|loss|draw), score?
```

`warbandId` stays nullable until Phase 6 defines warbands. Without that
nullable escape hatch this phase blocks on Phase 6 unnecessarily.

### 2.3 Campaign graph canvas (Phase 4) — ~2 days

**The data layer is done and tested** — `campaignGraphSchema` validates
nodes, edges, dangling references, self-loops, duplicate ids, and
multiple start nodes (13 tests). `saveCampaignGraphAction` persists it.
The campaign detail page renders the graph read-only as an outline.

What is missing is only the drag-and-drop editing surface. It does not
strictly need the design bundle — a functional node/edge editor can be
built from the FL tokens — but it will be _your_ design, not the one
originally intended. Get that agreed before starting.

---

## 3. What is blocked, and exactly what unblocks it

### Phases 5 & 6 — map editor, warband builder

**Blocked on:** the missing design bundle (§0.3), and for warbands, an
undefined data model.

**To unblock:** either restore the prototypes, **or** explicitly accept
newly-designed UI. The FL tokens and 9 primitives are enough to build
against; the cost is that the result reflects the implementer's design
judgment rather than the original intent.

For warbands, someone must define what a roster contains: fighter
entries, stat blocks, equipment, faction rules, points limits. Five
lines of answer unblocks the schema.

### Phase 9 — monetization

**Blocked on:** Stripe keys. This is the cheapest unblock of the four —
**test-mode keys are free and need no billing details.**

Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env.local`,
then build against the real test API with the Stripe CLI forwarding
webhooks to `/api/webhooks/stripe`. The `subscriptions` and
`entitlements` tables already exist and are wired into quota checks.

### Phase 10 — hosting

**Blocked on:** an AWS account, a registered domain, and SES production
access. Partially reachable: the Lightsail config, deploy workflow,
backup scripts, and Cloudflare setup can all be _written_, and the
production image already builds and serves. What cannot be done without
the account is **performing and verifying a deploy** — do not mark this
phase done from config alone.

---

## 4. Things that will bite you

Hard-won, in rough order of how much time they cost.

- **`next build` while `next dev` is running corrupts `.next`.** The dev
  server then serves 404s and ENOENTs for pages that exist. Kill dev
  first, or `rm -rf .next` after.
- **`loading.tsx` applies to its segment _and all nested routes_.** A
  skeleton at `scenarios/` also wrapped `scenarios/[username]/[slug]`,
  which starts streaming and flushes a 200 _before_ `notFound()` can set
  404 — turning every missing scenario into a soft-404. Hence the
  `(browse)` route group.
- **`"use server"` makes every export a public RPC endpoint.** A query
  helper taking a `userId` in an actions file is a data leak. Reads live
  in `src/lib/queries/`, which is server-only.
- **The e2e suite shares one database and must run serially.**
  `fullyParallel: false`, `workers: 1`. Parallel workers interleave user
  fixtures and produce phantom failures.
- **Tests that read per-user data must assert _which user_ first.** A
  `waitForURL` after login only proves the redirect fired, not that the
  session cookie belongs to the new account. This caused a 1-in-3 flake.
- **Sessions are JWTs, not database rows.** Deleting a user does not
  invalidate their cookie — `deleteAccountAction` must sign out
  explicitly, or the deleted user is locked out of `/login` by
  middleware.
- **Empty-string env vars are not `undefined`.** `.env` files spell
  "unset" as `FOO=""`, which fails `.optional()` validators. See the
  `optional()` helper in `src/lib/env.ts`.
- **`next build` sets `NODE_ENV=production`.** Production-only guardrails
  must skip when `NEXT_PHASE === "phase-production-build"`, or building
  an image locally fails on rules meant for a deployed server.
- **nodemailer is pinned to ^9 via an npm override.** next-auth v5 peers
  a 7.x with unpatched SMTP-injection advisories. The rationale is in
  `package.json`; do not "clean up" the peer warning by removing it.

---

## 5. Known gaps recorded but not fixed

- **OAuth is untested.** Google and GitHub providers are wired and will
  register only when their env vars are present, but no real OAuth app
  has ever been used against them.
- **Email verification is unbuilt.** `users.emailVerified` exists and
  nothing sets it.
- **Deleting an account leaves its uploaded objects in storage.** The
  rows cascade; the R2/MinIO objects do not. Needs a sweep over
  `uploaded_files` before the user row goes.
- **`next lint` is deprecated** and removed in Next.js 16. Already
  migrated to the ESLint CLI, but `eslint-config-next` will need
  attention at that upgrade.
- **6 moderate `npm audit` advisories** in postcss via next, with no
  non-breaking fix. `npm audit --audit-level=high` is the CI gate.
- **Legal pages are drafts** and explicitly marked as not reviewed by a
  lawyer.
