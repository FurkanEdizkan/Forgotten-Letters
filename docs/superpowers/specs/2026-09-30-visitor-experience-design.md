# Visitor experience: public map, sky switch, sign-in page and account requests

Date: 2026-09-30 · Status: approved design, awaiting spec review

## Intent

A new player who has not signed in should land on the live map and immediately understand the
campaign: the battlefield as it stands, and who is leading. Nothing on screen should invite them
anywhere except to sign in. The sign-in page is a quiet, centred door that will later sit over
pictures from the campaign's history and heroes.

What the user asked for, and the answers given during brainstorming:

- Signed-out visitors see the current map and the leaderboard, docked on the right, with each
  warband's **faction symbol** (never the player portrait).
- The weather switch moves out of the top band to the **top-left of the map**, named
  **Clear skies**. Clicking it removes the animations and shows the plain battle map; the button
  then reads **Satellite view**, and clicking that brings the animations back at the latest state
  of the battlefield.
- For signed-out visitors there are no other buttons, except what was kept on purpose: clicking
  zones opens their info, the battle strip at the top, the live dot, and the campaign lockup.
- A **Sign in** button leads to a simple login page: Sign in, Create account and Forgot password
  in the middle of the screen, on a half-transparent dark band across the middle, over a
  background that is left empty for now.
- **Create account** is a request the Campaign Master approves. **Forgot password** is a request
  the Campaign Master answers with a temporary password. There is no email.

## 1. The map for signed-out visitors

Files: `app/src/routes/(public)/+layout.svelte`, `app/src/routes/(public)/+page.svelte`.

- **Layout:** when `data.user` is null, the layout renders neither `NavPanel` nor its handle, and
  the shell gets no panel padding. The skip link stays. The running footer on reading pages is
  unchanged.
- **Top band:** keeps the lockup, the battle strip and the live dot. For signed-out visitors the
  Weather and Standings chips are removed and a **Sign in** chip, a link to
  `/login?next=<current path>`, takes their place at the right.
- **Standings, docked:** for signed-out visitors the standings are a permanent panel on the right
  edge of the map plate: the same ruled list as today's drawer, 22rem wide, from just below the
  band to the bottom inset. Each row shows the faction symbol through `Portrait` with
  `portrait={null}`, so the symbol always wins. When a zone or warband sheet opens, it lays over
  the docked standings, as book pages already lay over the map; closing the sheet reveals them
  again.
- **Phones (below 40rem):** a docked panel would cover the map, so it becomes a **Standings** chip
  in the band that opens the existing drawer.
- **Signed-in players:** keep today's page: the navigation panel, the Standings toggle and zone
  sheets. The only change for them is the sky switch below.

## 2. Clear skies / Satellite view (everyone)

File: `app/src/routes/(public)/+page.svelte`.

- **Placement:** one chip at the top-left of the map plate, just below the band (`top: var(--band)`
  plus the usual 14px inset). The navigation handle floats over the band, so the two do not meet.
  The Weather chip in the band is removed for everyone.
- **Behaviour:** it drives the existing `fxEnabled` switch. With effects on, the chip reads
  **Clear skies**; clicking it sets `fxEnabled = false`, which drops weather, the day cycle, lights
  and one-off triggers, leaving the map, markers and monuments. The chip then reads
  **Satellite view**; clicking it sets `fxEnabled = true`. `LiveMap` already recomputes the wanted
  effects from the live snapshot on every change, so turning them back on shows the battlefield
  as it is now, not as it was when the skies were cleared.
- **Memory:** the choice stays per device in `localStorage` under the existing `cf-fx` key, so
  nobody's current preference is lost.
- `aria-pressed` is dropped: the label names the action that will happen, so it is a plain button.

## 3. The sign-in page

Files: `app/src/routes/login/+page.svelte`, `app/src/routes/login/+page.server.ts`.

- **Background:** a full-screen layer (`.backdrop`) behind everything, a plain night field for
  now. It is the slot where campaign-history and hero pictures go later; no image is shipped.
- **Band:** a full-width, half-transparent dark band (`rgba(10, 9, 7, 0.6)`, blood hairlines top
  and bottom) centred vertically. On it, centred: the lockup, a row of three tabs
  (**Sign in · Create account · Forgot password**) and the chosen tab's form, in bone on night.
- **Tabs:** links to `?tab=signup` and `?tab=reset` (sign in is the default), so each view has an
  address, works without JavaScript and survives a failed submission. Each form posts to its own
  named action: `?/signin`, `?/signup`, `?/reset`.
- **Sign in:** unchanged fields and behaviour (username, password, remember me). The existing
  default action becomes the named `signin` action.
- **Create account:** username, display name, password and password again. On success the band
  shows "Sent to the Campaign Master for approval. You can sign in once they accept it."
- **Forgot password:** username only. It always answers "If that account exists, the Campaign
  Master has been asked to reset it", whether or not it does.
- A **Back to the map** link sits under the band.

## 4. Account requests

### Data

A new table `account_request` in `app/src/lib/server/db/schema.ts`, with migration `0011`:

| column | type | notes |
|---|---|---|
| `id` | text, primary key | the schema's usual `id()` |
| `kind` | `'signup'` or `'reset'` | |
| `username` | text, not null | normalised with `normaliseUsername` |
| `display_name` | text | sign-ups only |
| `password_hash` | text | sign-ups only, hashed with `hashPassword` |
| `created_at` | timestamp | the schema's usual `createdAt()` |

There is a unique index on `(kind, username)`, so repeating a request replaces nothing and adds
nothing. The comment on `user` ("Created by the CM; nobody signs up") is updated.

### Server module

A new module, `app/src/lib/server/requests.ts`, that owns all request logic, with one function
per operation:

- `requestSignup({ username, displayName, password })` returns `{ ok: true }` or
  `{ ok: false, message }`. The username must match `USERNAME` and be free among users and
  pending sign-ups, the password must be at least `MIN_PASSWORD` characters, and the display
  name is trimmed and capped at 40 characters.
- `requestReset(username)` returns nothing. It stores a row only when an enabled account has
  that username; the caller shows the same answer either way.
- `listRequests()` returns the pending rows, oldest first, without password hashes.
- `approveSignup(id)` creates the user (role `player`, `mustChangePassword: false`, using the
  stored hash) and deletes the request. If the username was taken in the meantime, it returns an
  error and keeps the request.
- `declineRequest(id)` deletes a request of either kind.
- `resolveReset(id)` issues a temporary password through the same path as the existing Players
  `reset` action, deletes the request, and returns the temporary password for the Campaign Master
  to pass on.

Abuse: a new limiter, `requestLimiter = rateLimiter(5, 10 * 60_000)`, keyed by client address,
guards both public actions. At most 50 sign-up requests can be pending at once; beyond that the
form answers "The Campaign Master has too many requests waiting. Try again later."

### Admin

File: `app/src/routes/admin/players/+page.server.ts` and `+page.svelte`.

- A **Requests** section at the top of the Players page, shown only when requests are pending.
- Sign-ups show the username, display name and when requested, with **Approve** and **Decline**.
- Resets show the username and when requested, with **Issue temporary password** and **Dismiss**.
  An issued password is shown the same way the existing reset shows it.
- Linking the new account to a player seat stays where it is today, on the same page.

### Hooks

`/login` is already reachable signed out. No new routes are added, so `hooks.server.ts` does not
change.

## Error handling

- Form validation errors come back through `fail(400, { tab, message, …fields })` and are shown
  in the band with the fields kept, except passwords.
- Rate-limit and capacity refusals use `fail(429, …)`.
- Approving a sign-up whose username was taken since the request surfaces an error on the Players
  page, and the request stays so the Campaign Master can decline it.

## Testing

- `requests.spec.ts` (Vitest, next to the module, like `passwords.spec.ts`) covers validation,
  duplicate usernames, the pending cap, that reset requests for unknown users store nothing, and
  that approval creates a usable account.
- `npm run check` (svelte-check) passes.
- A browser pass, desktop and phone width: the map signed out (standings docked, only Sign in,
  Clear skies / Satellite view toggling), the map signed in (panel, standings toggle, sky switch),
  and the login page's three tabs, including a failed and a successful submission of each.
- The Campaign Master approves a sign-up and resolves a reset from Admin → Players, then the new
  account signs in.

## Out of scope

- Pictures for the sign-in background (the slot exists; the art comes later).
- Email of any kind.
- A notification or badge for pending requests outside the Players page.
