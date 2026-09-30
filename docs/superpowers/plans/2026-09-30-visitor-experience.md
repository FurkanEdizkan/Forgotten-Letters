# Visitor Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-out visitors land on a clean live map (docked standings with faction symbols, a Clear skies / Satellite view switch, a Sign in chip), and the sign-in page becomes a centred band with Sign in, Create account and Forgot password, backed by account requests the Campaign Master approves.

**Architecture:** Pure request validation lives in `request-rules.ts` (unit-tested); database operations for requests live in `requests.ts`, used by the login page's named form actions and by new actions on Admin → Players. The map page and the public layout branch on `page.data.user` to decide what a visitor sees; the sky switch reuses the existing `fxEnabled` flag that `LiveMap` already reacts to.

**Tech Stack:** SvelteKit 2 with Svelte 5 runes, TypeScript, Drizzle ORM on Postgres (`drizzle-kit` migrations in `app/drizzle/`), Vitest (`npm test`), `svelte-check` (`npm run check`), PixiJS map (`LiveMap.svelte`, untouched).

**Spec:** `docs/superpowers/specs/2026-09-30-visitor-experience-design.md`

## Global Constraints

- All commands run from `app/` unless stated. Dev database: from the repo root, `docker compose -f compose.yaml -f compose.dev.yaml up -d db`; app: `npm run dev` on http://localhost:5173. Migrations run on server start.
- Tabs are addressed as `?tab=signup` and `?tab=reset` (sign in is the default) and post to named actions `?/signin`, `?/signup`, `?/reset`.
- Sign-up success copy: "Sent to the Campaign Master for approval. You can sign in once they accept it."
- Reset copy (always, whether the account exists or not): "If that account exists, the Campaign Master has been asked to reset it."
- Capacity copy: "The Campaign Master has too many requests waiting. Try again later."
- `requestLimiter = rateLimiter(5, 10 * 60_000)`, keyed by client address; at most 50 pending sign-ups.
- Display names are trimmed and capped at 40 characters; usernames use `normaliseUsername` and `USERNAME`; passwords at least `MIN_PASSWORD` (8).
- Approved sign-ups: role `player`, `mustChangePassword: false`, the stored hash.
- Sky switch labels: **Clear skies** when effects are on, **Satellite view** when off; stored per device under `localStorage` key `cf-fx`.
- Docked standings: 22rem wide, right edge; below 40rem they become a **Standings** chip opening the drawer. Standings rows use `Portrait` with `portrait={null}`.
- Login band background: `rgba(10, 9, 7, 0.6)` with blood hairlines top and bottom; the `.backdrop` layer ships with no image.
- Design rules from `DESIGN.md`: radius 0 everywhere, no new hues, Pirata One capitals (`var(--font-title)`) for chips.
- Commits follow Conventional Commits and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit locally; do not push.

## Review Focus

1. **The omen banner collides with the docked standings.** The "…across the front" banner sits at the bottom-right, where the dock now lives; it must stay readable. Task 6 moves it to the bottom-left and the browser pass checks it with a map-wide weather event.
2. **A visitor who follows "Read the lore →" has no way back.** Signed-out reading pages have no navigation panel; they need a link back to the live map. Task 6 adds it and the browser pass follows it.
3. **`next` on `/login` is followed unchecked when already signed in.** `load` redirects to `url.searchParams.get('next')` as-is; an off-site `next` must fall back to `/`. Task 3 routes it through `safeNext`, and the tabs and form actions keep `next` so a visitor lands where they came from.
4. **Messy usernames and two requests for the same name.** "  Alric " must become `alric`, and a second sign-up request, or one for an existing account, must be refused rather than duplicated. Task 1 tests normalisation and Task 2 checks users and pending rows, with a unique index behind it.
5. **A sign-up approved after someone else took the name.** Approving must refuse and keep the request, not crash or overwrite. Task 2 guards it in a transaction and Task 7 checks it in the browser.

---

## File Structure

| File | Responsibility |
|---|---|
| Create `app/src/lib/server/request-rules.ts` | Pure validation of a sign-up form; the pending cap constant. |
| Create `app/src/lib/server/request-rules.spec.ts` | Unit tests for the above. |
| Modify `app/src/lib/server/db/schema.ts` | `accountRequest` table; update the `user` comment. |
| Create `app/drizzle/0011_account_requests.sql` (generated) | Migration for the table. |
| Create `app/src/lib/server/requests.ts` | Database operations: request, list, approve, decline, resolve; `requestLimiter`. |
| Modify `app/src/routes/login/+page.server.ts` | Named actions `signin`, `signup`, `reset`; safe `next` in `load`. |
| Modify `app/src/routes/login/+page.svelte` | Backdrop, dark band, tabs and the three forms. |
| Modify `app/src/routes/admin/players/+page.server.ts` | Load requests; `approve`, `decline`, `resolveReset` actions. |
| Modify `app/src/routes/admin/players/+page.svelte` | Requests section; lede text. |
| Modify `app/src/routes/(public)/+page.svelte` | Sky switch; signed-out band, docked standings, phone chip, omen placement. |
| Modify `app/src/routes/(public)/+layout.svelte` | No navigation panel for visitors; back-to-map link on reading pages. |
| Modify `DESIGN.md` | Record the visitor map, sky switch and sign-in band. |

---

### Task 1: Sign-up validation rules

**Files:**
- Create: `app/src/lib/server/request-rules.ts`
- Test: `app/src/lib/server/request-rules.spec.ts`

**Interfaces:**
- Consumes: `MIN_PASSWORD`, `USERNAME`, `normaliseUsername` from `app/src/lib/server/passwords.ts`.
- Produces:
  - `export const MAX_PENDING_SIGNUPS = 50`
  - `export interface SignupInput { username: string; displayName: string; password: string; confirm: string }`
  - `export type SignupCheck = { ok: true; value: { username: string; displayName: string | null; password: string } } | { ok: false; message: string }`
  - `export function checkSignup(input: SignupInput): SignupCheck`

- [ ] **Step 1: Record the baseline**

Run: `cd app && npm test && npm run check 2>&1 | tail -3`
Expected: tests pass. Note the `svelte-check` error and warning counts; later tasks must not add to them.

- [ ] **Step 2: Write the failing test**

Create `app/src/lib/server/request-rules.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_PENDING_SIGNUPS, checkSignup } from './request-rules';

const good = { username: 'alric', displayName: 'Alric of Ypres', password: 'trench-mud-1914', confirm: 'trench-mud-1914' };

describe('checkSignup', () => {
	it('accepts a good request and normalises it', () => {
		expect(checkSignup({ ...good, username: '  Alric ', displayName: '  Alric   of  Ypres ' })).toEqual({
			ok: true,
			value: { username: 'alric', displayName: 'Alric of Ypres', password: 'trench-mud-1914' }
		});
	});
	it('treats a blank display name as none and caps a long one at 40 characters', () => {
		const blank = checkSignup({ ...good, displayName: '   ' });
		expect(blank.ok && blank.value.displayName).toBe(null);
		const long = checkSignup({ ...good, displayName: 'x'.repeat(60) });
		expect(long.ok && long.value.displayName).toBe('x'.repeat(40));
	});
	it('rejects usernames the sign-in form could never accept', () => {
		for (const username of ['', 'a', 'al ric', '-alric', 'x'.repeat(33)]) {
			const r = checkSignup({ ...good, username });
			expect(r.ok, username).toBe(false);
		}
	});
	it('rejects a short password and a mismatched confirmation', () => {
		expect(checkSignup({ ...good, password: 'short', confirm: 'short' })).toEqual({
			ok: false,
			message: 'Passwords need at least 8 characters.'
		});
		expect(checkSignup({ ...good, confirm: 'trench-mud-1915' })).toEqual({
			ok: false,
			message: 'The two passwords do not match.'
		});
	});
	it('caps pending sign-ups at 50', () => {
		expect(MAX_PENDING_SIGNUPS).toBe(50);
	});
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd app && npx vitest run src/lib/server/request-rules.spec.ts`
Expected: FAIL, "Failed to resolve import './request-rules'".

- [ ] **Step 4: Write the implementation**

Create `app/src/lib/server/request-rules.ts`:

```ts
import { MIN_PASSWORD, USERNAME, normaliseUsername } from './passwords';

/** Beyond this many waiting sign-ups the form turns people away, so a stranger can't flood the list. */
export const MAX_PENDING_SIGNUPS = 50;

export interface SignupInput {
	username: string;
	displayName: string;
	password: string;
	confirm: string;
}

export type SignupCheck =
	| { ok: true; value: { username: string; displayName: string | null; password: string } }
	| { ok: false; message: string };

/** Check a sign-up form as typed. Whether the username is free is the database's question, not this one's. */
export function checkSignup(input: SignupInput): SignupCheck {
	const username = normaliseUsername(input.username);
	if (!USERNAME.test(username))
		return {
			ok: false,
			message: 'Usernames are 2–32 lowercase letters, digits, dots, dashes or underscores, starting with a letter or digit.'
		};
	if (input.password.length < MIN_PASSWORD) return { ok: false, message: `Passwords need at least ${MIN_PASSWORD} characters.` };
	if (input.password !== input.confirm) return { ok: false, message: 'The two passwords do not match.' };
	const displayName = input.displayName.trim().replace(/\s+/g, ' ').slice(0, 40) || null;
	return { ok: true, value: { username, displayName, password: input.password } };
}
```

- [ ] **Step 5: Run the tests**

Run: `cd app && npx vitest run src/lib/server/request-rules.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/server/request-rules.ts app/src/lib/server/request-rules.spec.ts
git commit -m "feat: sign-up request validation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Account request table and server module

**Files:**
- Modify: `app/src/lib/server/db/schema.ts` (after the `user` table, around line 352; the `user` comment at line 337)
- Create: `app/drizzle/0011_account_requests.sql` (generated, plus `app/drizzle/meta/` updates)
- Create: `app/src/lib/server/requests.ts`

**Interfaces:**
- Consumes: `checkSignup`, `MAX_PENDING_SIGNUPS`, `SignupInput` (Task 1); `db` from `$lib/server/db`; `setPassword`, `endAllSessions` from `$lib/server/auth`; `hashPassword`, `normaliseUsername`, `rateLimiter`, `temporaryPassword` from `$lib/server/passwords`.
- Produces:
  - `export const accountRequest` (Drizzle table, in `schema.ts`)
  - `export const requestLimiter: ReturnType<typeof rateLimiter>`
  - `export async function requestSignup(input: SignupInput): Promise<{ ok: true } | { ok: false; status: 400 | 429; message: string }>`
  - `export async function requestReset(rawUsername: string): Promise<void>`
  - `export interface PendingRequest { id: string; kind: 'signup' | 'reset'; username: string; displayName: string | null; createdAt: Date }`
  - `export async function listRequests(): Promise<PendingRequest[]>`
  - `export async function approveSignup(id: string): Promise<{ ok: true; username: string } | { ok: false; message: string }>`
  - `export async function declineRequest(id: string): Promise<void>`
  - `export async function resolveReset(id: string): Promise<{ ok: true; username: string; password: string } | { ok: false; message: string }>`

There are no database tests in this project (Vitest runs without Postgres), so this module's behaviour is checked through the pages in Task 7. The pure rules it relies on are tested in Task 1.

- [ ] **Step 1: Add the table**

In `app/src/lib/server/db/schema.ts`, change the comment above `export const user` from

```ts
/** Accounts: the Campaign Master and the players. Created by the CM; nobody signs up. */
```

to

```ts
/** Accounts: the Campaign Master and the players. Made by the CM, or requested at sign-in and approved by the CM. */
```

and add directly after the closing `});` of the `user` table:

```ts
/** Sign-up and password-reset requests from the sign-in page, waiting for the Campaign Master. */
export const accountRequest = pgTable(
	'account_request',
	{
		id: id(),
		kind: text('kind', { enum: ['signup', 'reset'] }).notNull(),
		/** Lowercase, as in `user`. */
		username: text('username').notNull(),
		/** Sign-ups only. */
		displayName: text('display_name'),
		/** Sign-ups only: the password the player chose, already hashed. */
		passwordHash: text('password_hash'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('account_request_kind_username_idx').on(t.kind, t.username)]
);
```

- [ ] **Step 2: Generate the migration**

Run: `cd app && npm run db:generate -- --name account_requests`
Expected: `drizzle/0011_account_requests.sql` is created containing `CREATE TABLE "account_request"` and `CREATE UNIQUE INDEX "account_request_kind_username_idx"`, and nothing else. If it contains anything else, stop: the schema and the snapshots disagree.

- [ ] **Step 3: Write the module**

Create `app/src/lib/server/requests.ts`:

```ts
import { and, asc, count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { accountRequest, user } from '$lib/server/db/schema';
import { endAllSessions, setPassword } from '$lib/server/auth';
import { hashPassword, normaliseUsername, rateLimiter, temporaryPassword } from '$lib/server/passwords';
import { MAX_PENDING_SIGNUPS, checkSignup, type SignupInput } from '$lib/server/request-rules';

/** Both public forms share it, per client address: five requests every ten minutes. */
export const requestLimiter = rateLimiter(5, 10 * 60_000);

export interface PendingRequest {
	id: string;
	kind: 'signup' | 'reset';
	username: string;
	displayName: string | null;
	createdAt: Date;
}

/** A visitor asks for an account. It stays a request until the Campaign Master approves it. */
export async function requestSignup(
	input: SignupInput
): Promise<{ ok: true } | { ok: false; status: 400 | 429; message: string }> {
	const checked = checkSignup(input);
	if (!checked.ok) return { ok: false, status: 400, message: checked.message };
	const { username, displayName, password } = checked.value;
	const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
	const [asked] = await db
		.select({ id: accountRequest.id })
		.from(accountRequest)
		.where(and(eq(accountRequest.kind, 'signup'), eq(accountRequest.username, username)));
	if (taken || asked) return { ok: false, status: 400, message: 'That username is taken. Choose another.' };
	const [{ n }] = await db.select({ n: count() }).from(accountRequest).where(eq(accountRequest.kind, 'signup'));
	if (n >= MAX_PENDING_SIGNUPS)
		return { ok: false, status: 429, message: 'The Campaign Master has too many requests waiting. Try again later.' };
	// The unique index settles a race between two identical requests.
	await db
		.insert(accountRequest)
		.values({ kind: 'signup', username, displayName, passwordHash: await hashPassword(password) })
		.onConflictDoNothing();
	return { ok: true };
}

/** A visitor has forgotten their password. Stored only for an enabled account; the caller answers the same either way. */
export async function requestReset(rawUsername: string) {
	const username = normaliseUsername(rawUsername).slice(0, 32);
	const [u] = await db.select({ disabled: user.disabled }).from(user).where(eq(user.username, username));
	if (!u || u.disabled) return;
	await db.insert(accountRequest).values({ kind: 'reset', username }).onConflictDoNothing();
}

/** Everything waiting, oldest first. Password hashes never leave this module. */
export async function listRequests(): Promise<PendingRequest[]> {
	return db
		.select({
			id: accountRequest.id,
			kind: accountRequest.kind,
			username: accountRequest.username,
			displayName: accountRequest.displayName,
			createdAt: accountRequest.createdAt
		})
		.from(accountRequest)
		.orderBy(asc(accountRequest.createdAt));
}

/** Turn a sign-up request into a player account with the password they chose. */
export async function approveSignup(id: string): Promise<{ ok: true; username: string } | { ok: false; message: string }> {
	return db.transaction(async (tx) => {
		const [r] = await tx
			.select()
			.from(accountRequest)
			.where(and(eq(accountRequest.id, id), eq(accountRequest.kind, 'signup')));
		if (!r?.passwordHash) return { ok: false as const, message: 'That request is gone.' };
		const [taken] = await tx.select({ id: user.id }).from(user).where(eq(user.username, r.username));
		if (taken)
			return { ok: false as const, message: `"${r.username}" is already an account. Decline this request instead.` };
		await tx.insert(user).values({
			username: r.username,
			displayName: r.displayName,
			passwordHash: r.passwordHash,
			role: 'player',
			mustChangePassword: false
		});
		await tx.delete(accountRequest).where(eq(accountRequest.id, id));
		return { ok: true as const, username: r.username };
	});
}

/** Decline a sign-up or dismiss a reset request. */
export async function declineRequest(id: string) {
	await db.delete(accountRequest).where(eq(accountRequest.id, id));
}

/** Answer a reset request with a temporary password, exactly as Admin → Players → Reset password does. */
export async function resolveReset(
	id: string
): Promise<{ ok: true; username: string; password: string } | { ok: false; message: string }> {
	const [r] = await db
		.select()
		.from(accountRequest)
		.where(and(eq(accountRequest.id, id), eq(accountRequest.kind, 'reset')));
	if (!r) return { ok: false, message: 'That request is gone.' };
	await db.delete(accountRequest).where(eq(accountRequest.id, id));
	const [u] = await db.select({ id: user.id, username: user.username }).from(user).where(eq(user.username, r.username));
	if (!u) return { ok: false, message: `There is no account "${r.username}" any more.` };
	const password = temporaryPassword();
	await setPassword(u.id, password, true);
	await endAllSessions(u.id);
	return { ok: true, username: u.username, password };
}
```

- [ ] **Step 4: Type-check and run the tests**

Run: `cd app && npm run check 2>&1 | tail -3 && npm test`
Expected: no new `svelte-check` errors compared with the Task 1 baseline; all tests pass.

- [ ] **Step 5: Apply the migration**

Start the database (repo root: `docker compose -f compose.yaml -f compose.dev.yaml up -d db`), then `cd app && npm run dev` and load http://localhost:5173 once. Migrations run on start.
Expected: the dev server logs no migration error. Check with `docker exec forgotten-letters-db-1 psql -U carcass -d carcass -c '\d account_request'`, which lists the six columns and the unique index. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/server/db/schema.ts app/drizzle app/src/lib/server/requests.ts
git commit -m "feat: account request table and server module" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sign-in page with three tabs

**Files:**
- Modify: `app/src/routes/login/+page.server.ts` (whole file)
- Modify: `app/src/routes/login/+page.svelte` (whole file)
- Modify: `DESIGN.md` (Navigation section)

**Interfaces:**
- Consumes: `requestLimiter`, `requestSignup`, `requestReset` (Task 2).
- Produces: form results `{ tab: 'signin' | 'signup' | 'reset', message?, username?, displayName?, sent? }`.

- [ ] **Step 1: Replace the server file**

Replace `app/src/routes/login/+page.server.ts` with:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { FORGET_COOKIE, SESSION_COOKIE, authenticate, createSession, loginLimiter } from '$lib/server/auth';
import { normaliseUsername } from '$lib/server/passwords';
import { requestLimiter, requestReset, requestSignup } from '$lib/server/requests';
import type { Actions, PageServerLoad } from './$types';

/** Only same-site paths are followed after sign-in. */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')) ?? '/');
	return {};
};

export const actions: Actions = {
	signin: async ({ request, cookies, url, getClientAddress }) => {
		const data = await request.formData();
		const username = normaliseUsername(String(data.get('username') ?? '')).slice(0, 32);
		const password = String(data.get('password') ?? '').slice(0, 200);
		if (!loginLimiter.take(`ip:${getClientAddress()}`) || !loginLimiter.take(`user:${username}`))
			return fail(429, { tab: 'signin' as const, username, message: 'Too many attempts. Wait a minute and try again.' });
		const u = await authenticate(username, password);
		if (!u)
			return fail(401, {
				tab: 'signin' as const,
				username,
				message: 'That username and password do not match, or the account is disabled.'
			});
		loginLimiter.clear(`user:${username}`);
		const { token, maxAge } = await createSession(u.id, request.headers.get('user-agent'));
		// "Remember me": a cookie that lasts the session's 30 days; otherwise one that ends when the browser closes.
		const remember = data.has('remember');
		const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' } as const;
		cookies.set(SESSION_COOKIE, token, remember ? { ...opts, maxAge } : opts);
		if (remember) cookies.delete(FORGET_COOKIE, { path: '/' });
		else cookies.set(FORGET_COOKIE, '1', opts);
		if (u.mustChangePassword) redirect(303, '/settings?first=1');
		redirect(303, safeNext(url.searchParams.get('next')) ?? (u.role === 'cm' ? '/admin' : '/'));
	},

	signup: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').slice(0, 64);
		const displayName = String(data.get('displayName') ?? '').slice(0, 80);
		if (!requestLimiter.take(`ip:${getClientAddress()}`))
			return fail(429, {
				tab: 'signup' as const,
				username,
				displayName,
				message: 'Too many requests from here. Wait a few minutes and try again.'
			});
		const r = await requestSignup({
			username,
			displayName,
			password: String(data.get('password') ?? '').slice(0, 200),
			confirm: String(data.get('confirm') ?? '').slice(0, 200)
		});
		if (!r.ok) return fail(r.status, { tab: 'signup' as const, username, displayName, message: r.message });
		return { tab: 'signup' as const, sent: true };
	},

	reset: async ({ request, getClientAddress }) => {
		const username = String((await request.formData()).get('username') ?? '').slice(0, 64);
		if (!requestLimiter.take(`ip:${getClientAddress()}`))
			return fail(429, { tab: 'reset' as const, username, message: 'Too many requests from here. Wait a few minutes and try again.' });
		await requestReset(username);
		return { tab: 'reset' as const, sent: true };
	}
};
```

- [ ] **Step 2: Replace the page**

Replace `app/src/routes/login/+page.svelte` with:

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Lockup from '$lib/components/Lockup.svelte';

	let { form } = $props();
	let busy = $state(false);

	type Tab = 'signin' | 'signup' | 'reset';
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'signin', label: 'Sign in' },
		{ id: 'signup', label: 'Create account' },
		{ id: 'reset', label: 'Forgot password' }
	];
	const asTab = (v: string | null | undefined): Tab | null => (TABS.some((t) => t.id === v) ? (v as Tab) : null);
	// A failed or finished submission names its own tab; otherwise the address does.
	const tab = $derived<Tab>(asTab(form?.tab) ?? asTab(page.url.searchParams.get('tab')) ?? 'signin');
	// Where the visitor was before; kept across tabs and form posts so sign-in returns them there.
	const next = $derived(page.url.searchParams.get('next'));
	const withNext = (q: URLSearchParams) => {
		if (next) q.set('next', next);
		return q;
	};
	const tabHref = (id: Tab) => {
		const q = withNext(new URLSearchParams(id === 'signin' ? {} : { tab: id })).toString();
		return `/login${q ? `?${q}` : ''}`;
	};
	const action = (name: Tab) => `?/${name}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

	const submit = () => {
		busy = true;
		return async ({ update }: { update: (o: { reset: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};
</script>

<svelte:head><title>{TABS.find((t) => t.id === tab)?.label} · Carcass Front</title></svelte:head>

<main class="cover">
	<!-- Pictures from the campaign's history and heroes go here later; for now, the night. -->
	<div class="backdrop" aria-hidden="true"></div>

	<section class="band">
		<div class="inner">
			<Lockup name="Carcass Front" />
			<nav class="tabs" aria-label="Account">
				{#each TABS as t (t.id)}
					<a href={tabHref(t.id)} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
				{/each}
			</nav>

			{#if tab === 'signin'}
				<form method="POST" action={action('signin')} use:enhance={submit}>
					<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
					<label>Password <input name="password" type="password" autocomplete="current-password" required /></label>
					<label class="remember"><input type="checkbox" name="remember" checked /> Remember me on this device</label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
				</form>
			{:else if tab === 'signup'}
				{#if form?.sent}
					<p class="sent" role="status">Sent to the Campaign Master for approval. You can sign in once they accept it.</p>
				{:else}
					<form method="POST" action={action('signup')} use:enhance={submit}>
						<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
						<label>Display name <input name="displayName" autocomplete="nickname" placeholder="optional" value={form && 'displayName' in form ? (form.displayName ?? '') : ''} /></label>
						<label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8" /></label>
						<label>Password again <input name="confirm" type="password" autocomplete="new-password" required minlength="8" /></label>
						{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
						<button disabled={busy}>{busy ? 'Sending…' : 'Request an account'}</button>
						<p class="hint">The Campaign Master approves every account.</p>
					</form>
				{/if}
			{:else if form?.sent}
				<p class="sent" role="status">If that account exists, the Campaign Master has been asked to reset it.</p>
			{:else}
				<form method="POST" action={action('reset')} use:enhance={submit}>
					<label>Username <input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required value={form?.username ?? ''} /></label>
					{#if form?.message}<p class="error" role="alert">{form.message}</p>{/if}
					<button disabled={busy}>{busy ? 'Sending…' : 'Ask for a reset'}</button>
					<p class="hint">The Campaign Master will give you a temporary password to sign in with.</p>
				</form>
			{/if}
		</div>
	</section>

	<a class="back" href="/">Back to the map</a>
</main>

<style>
	.cover {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto 1fr;
		min-height: 100vh;
		background: var(--night);
		color: var(--bone);
	}
	.backdrop {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 30%, var(--night-2), var(--night) 70%);
		background-size: cover;
		background-position: center;
	}
	/* The half-transparent band across the middle that carries everything. */
	.band {
		position: relative;
		grid-row: 2;
		padding: 28px 16px 30px;
		background: rgba(10, 9, 7, 0.6);
		border-block: 1px solid var(--blood);
	}
	.inner {
		display: grid;
		justify-items: center;
		gap: 18px;
		width: min(24rem, 100%);
		margin: 0 auto;
	}
	.inner :global(.lockup) {
		justify-items: center;
	}
	.inner :global(.lockup .name) {
		font-size: 2.6rem;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 18px;
	}
	.tabs a {
		padding: 2px 0;
		color: var(--bone-dim);
		font-family: var(--font-title);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	.tabs a:hover {
		color: var(--bone);
	}
	.tabs a[aria-current='page'] {
		color: var(--bone);
		border-bottom-color: var(--blood-bright);
	}
	form {
		display: grid;
		gap: 14px;
		width: 100%;
	}
	label {
		display: grid;
		gap: 4px;
		font-weight: 600;
	}
	.remember {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 400;
	}
	.error {
		margin: 0;
		color: var(--ember);
	}
	.hint {
		margin: 0;
		font-size: 0.88rem;
		color: var(--bone-dim);
	}
	.sent {
		margin: 0;
		text-align: center;
	}
	.back {
		position: relative;
		grid-row: 3;
		justify-self: center;
		align-self: start;
		margin-top: 18px;
		color: var(--bone-dim);
	}
	.back:hover {
		color: var(--bone);
	}
</style>
```

- [ ] **Step 3: Update DESIGN.md**

In `DESIGN.md`, under `### Navigation`, add after the **Cover lockup** bullet:

```markdown
- **Sign-in band:** the sign-in page is a full-screen backdrop (the slot for campaign-history and hero pictures; a night field until they exist) crossed by a full-width, half-transparent night band (`rgba(10, 9, 7, 0.6)`, blood hairlines top and bottom). On it, centred: the cover lockup, three Pirata One tabs (Sign in · Create account · Forgot password; the current one Bone with a Fresh Blood underline) and the chosen form in bone.
```

- [ ] **Step 4: Type-check**

Run: `cd app && npm run check 2>&1 | tail -3`
Expected: no new errors compared with the Task 1 baseline. If `form?.username` or `form.displayName` fails to type (the union of action results), narrow with `'username' in form` the way the display-name field already does.

- [ ] **Step 5: Try it in the browser**

With the database and `npm run dev` running, open http://localhost:5173/login?next=/zones.
Expected:
- The band sits across the middle, with the lockup, the three tabs and the sign-in form centred.
- Each tab link keeps `next=/zones`.
- A wrong password shows the error on the **Sign in** tab.
- **Create account** with a mismatched password shows "The two passwords do not match." and keeps the username.
- A good request shows the "Sent to the Campaign Master…" line.
- **Forgot password** with a made-up name shows the same "If that account exists…" line as a real one.
- Signed in, `/login?next=https://evil.example` redirects to `/`.

- [ ] **Step 6: Commit**

```bash
git add app/src/routes/login DESIGN.md
git commit -m "feat: sign-in band with create-account and forgot-password tabs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Requests on Admin → Players

**Files:**
- Modify: `app/src/routes/admin/players/+page.server.ts` (`load` return at lines 25-38; `actions` from line 53)
- Modify: `app/src/routes/admin/players/+page.svelte` (lede at lines 14-18; add a section after the `form?.message` line)

**Interfaces:**
- Consumes: `listRequests`, `approveSignup`, `declineRequest`, `resolveReset`, `PendingRequest` (Task 2).
- Produces: page data `requests: PendingRequest[]`; actions `?/approve`, `?/decline`, `?/resolveReset`, which take form field `id`.

- [ ] **Step 1: Server**

In `app/src/routes/admin/players/+page.server.ts`, add the import:

```ts
import { approveSignup, declineRequest, listRequests, resolveReset } from '$lib/server/requests';
```

In `load`, add `requests: await listRequests(),` to the returned object, after `seats`:

```ts
		seats,
		requests: await listRequests()
```

Add these three actions inside `export const actions: Actions = {`, before `reset:`:

```ts
	approve: async ({ request }) => {
		const r = await approveSignup(String((await request.formData()).get('id')));
		if (!r.ok) return fail(409, { message: r.message });
		return { message: `Account "${r.username}" approved. Give it a seat below.` };
	},

	decline: async ({ request }) => {
		await declineRequest(String((await request.formData()).get('id')));
		return { message: 'Request removed.' };
	},

	resolveReset: async ({ request }) => {
		const r = await resolveReset(String((await request.formData()).get('id')));
		if (!r.ok) return fail(409, { message: r.message });
		return { issued: { username: r.username, password: r.password, why: 'reset' as const } };
	},

```

- [ ] **Step 2: Page**

In `app/src/routes/admin/players/+page.svelte`, replace the lede paragraph's first sentence

```
	Accounts are made here; nobody signs up. Give each player a username and a password (or let one be generated), and the
```

with

```
	Accounts are made here, or requested from the sign-in page and approved below. Give each player a username and a password (or let one be generated), and the
```

Directly after the line `{#if form?.message}<p class="note-line">{form.message}</p>{/if}`, insert:

```svelte
{#if data.requests.length}
	<section>
		<h2>Requests</h2>
		<ul class="accounts">
			{#each data.requests as r (r.id)}
				<li>
					<div class="who">
						<strong>{r.kind === 'signup' ? (r.displayName ?? r.username) : r.username}</strong>
						<small>
							{r.kind === 'signup' ? `${r.username} · asks for an account` : 'forgot their password'} · {when(r.createdAt)}
						</small>
					</div>
					<div class="tools">
						{#if r.kind === 'signup'}
							<form method="POST" action="?/approve" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="small">Approve</button></form>
							<form method="POST" action="?/decline" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="ghost small danger">Decline</button></form>
						{:else}
							<form method="POST" action="?/resolveReset" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="small">Issue temporary password</button></form>
							<form method="POST" action="?/decline" use:enhance={keep}><input type="hidden" name="id" value={r.id} /><button class="ghost small">Dismiss</button></form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}
```

- [ ] **Step 3: Type-check**

Run: `cd app && npm run check 2>&1 | tail -3`
Expected: no new errors compared with the baseline.

- [ ] **Step 4: Try it in the browser**

Sign in as the Campaign Master and open http://localhost:5173/admin/players.
Expected:
- The sign-up request from Task 3 is listed under **Requests**. **Approve** shows "Account "…" approved…", and the account appears under **Accounts** without "temporary password".
- Sign out and sign in with the new account and the password chosen at sign-up: it lands on the map, not on `/settings?first=1`.
- File a **Forgot password** request for that account, then sign back in as the Campaign Master. **Issue temporary password** shows the issued box. Signing in with it lands on `/settings?first=1`.
- With no requests pending, the **Requests** section is absent.

- [ ] **Step 5: Commit**

```bash
git add app/src/routes/admin/players
git commit -m "feat: approve sign-up and reset requests from Admin → Players" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Clear skies / Satellite view switch

**Files:**
- Modify: `app/src/routes/(public)/+page.svelte` (the Weather chip in `<nav>` around lines 238-248; styles `.chip[aria-pressed='false']`, `.short`, `.short.off`, and in the 34rem media query `.long` and `.short`)
- Modify: `DESIGN.md` (Map chips bullet)

**Interfaces:**
- Consumes: the existing `fxEnabled` state and `toggleFx()` in the same file (`cf-fx` storage key, unchanged).
- Produces: a `.sky` button that Task 6 leaves in place.

- [ ] **Step 1: Remove the Weather chip**

In `app/src/routes/(public)/+page.svelte`, delete this block from `<nav>`:

```svelte
				<button
					class="chip"
					onclick={toggleFx}
					aria-pressed={fxEnabled}
					title="Weather effects on this device"
				>
					<span class="long">{fxEnabled ? 'Weather on' : 'Weather off'}</span><span
						class="short"
						class:off={!fxEnabled}>Weather</span
					>
				</button>
```

- [ ] **Step 2: Add the sky switch**

Directly after the closing `</div>` of `<div class="band" …>`, insert:

```svelte
	<!-- One switch, top-left of the map: clear the sky to read the plain battle map, then back to the battlefield as it stands. -->
	<button
		class="chip sky"
		onclick={toggleFx}
		title={fxEnabled ? 'Hide weather and animations: the plain battle map' : 'Show the battlefield as it stands now, weather and all'}
	>
		{fxEnabled ? 'Clear skies' : 'Satellite view'}
	</button>
```

- [ ] **Step 3: Styles**

Delete these rules: `.chip[aria-pressed='false'] { … }`, `.short { display: none; }`, `.short.off { … }`, and inside `@media (max-width: 34rem)` the `.long { display: none; }` and `.short { display: inline; }` rules.

Add after the `.chip:hover` rule:

```css
	/* Floats on the map plate itself, clear of the navigation handle over the band. */
	.sky {
		position: absolute;
		z-index: 2;
		top: calc(var(--band) + 14px);
		left: 14px;
	}
```

- [ ] **Step 4: Update DESIGN.md**

In `DESIGN.md`, replace the sentence in the **Map chips** bullet

```
They now carry only what is local to the map — the weather switch, the standings toggle and the live dot — never navigation.
```

with

```
They now carry only what is local to the map — the standings toggle (or Sign in, for visitors) and the live dot — never navigation.
- **Sky switch:** one map chip floating at the top-left of the map plate, below the band. It reads **Clear skies** while weather and animations play, and clears them to the plain battle map; it then reads **Satellite view** and brings them back at the battlefield's current state. Remembered per device.
```

- [ ] **Step 5: Type-check and try it**

Run: `cd app && npm run check 2>&1 | tail -3`, then open http://localhost:5173/ with the dev server running.
Expected:
- No new check errors, and there is no Weather chip in the band.
- **Clear skies** sits at the top-left of the map below the band. Clicking it stops the weather and day-cycle effects and the label becomes **Satellite view**; clicking again brings the effects back as they stand now.
- A reload keeps the last choice.
- Signed in with the navigation panel closed, the handle and the switch don't overlap.

- [ ] **Step 6: Commit**

```bash
git add "app/src/routes/(public)/+page.svelte" DESIGN.md
git commit -m "feat: Clear skies / Satellite view switch on the map" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The map for signed-out visitors

**Files:**
- Modify: `app/src/routes/(public)/+layout.svelte` (the `{:else}` branch and styles)
- Modify: `app/src/routes/(public)/+page.svelte` (script, `<header class="bar">`, `<nav>`, the standings `<aside class="drawer">`, `.omen` and drawer styles)
- Modify: `DESIGN.md` (Navigation panel bullet)

**Interfaces:**
- Consumes: `page.data.user` (set by `(public)/+layout.server.ts`; `null` when signed out), `Portrait` props `name`, `portrait`, `symbol`, `faction`, `seal`, `size`.
- Produces: none.

- [ ] **Step 1: Layout without the panel for visitors**

In `app/src/routes/(public)/+layout.svelte`, replace the `{:else}` branch:

```svelte
{:else}
	<a class="skip" href="#main">Skip to content</a>
	<NavPanel bind:open={navOpen} title={live?.current.campaign.name ?? 'Carcass Front'} />
	<div class="shell" class:beside={navOpen && !isMap}>
		<main id="main" tabindex="-1">
```

with:

```svelte
{:else}
	<a class="skip" href="#main">Skip to content</a>
	{#if data.user}
		<NavPanel bind:open={navOpen} title={live?.current.campaign.name ?? 'Carcass Front'} />
	{/if}
	<div class="shell" class:beside={navOpen && !isMap && !!data.user} class:guest={!data.user}>
		{#if !data.user && !isMap}
			<!-- Visitors have no panel: a way back from the pages the map links to. -->
			<a class="to-map" href="/">← The live map</a>
		{/if}
		<main id="main" tabindex="-1">
```

Add after the `.shell.beside` rule (the later rule wins over `.shell:not(.beside)`):

```css
	/* No handle to keep clear for visitors. */
	.shell.guest {
		padding-top: 0;
	}
	.to-map {
		display: block;
		max-width: 72rem;
		margin-inline: auto;
		padding: 14px clamp(16px, 4vw, 40px) 0;
		color: var(--ink-soft);
		font-family: var(--font-title);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
	}
	.to-map:hover {
		color: var(--blood);
	}
```

- [ ] **Step 2: Map page script**

In `app/src/routes/(public)/+page.svelte`, after `const isAdmin = $derived(!!page.data.isAdmin);` add:

```ts
	// Visitors who haven't signed in see the map, the standings and a way to sign in; nothing else.
	const signedIn = $derived(!!page.data.user);
	const signInHref = $derived(`/login?next=${encodeURIComponent(page.url.pathname + page.url.search)}`);
```

- [ ] **Step 3: Band**

Change `<header class="bar">` to `<header class="bar" class:guest={!signedIn}>`, and replace the standings button in `<nav>`:

```svelte
				<button class="chip" onclick={() => (showStandings = !showStandings)}>Standings</button>
```

with:

```svelte
				{#if signedIn}
					<button class="chip" onclick={() => (showStandings = !showStandings)}>Standings</button>
				{:else}
					<!-- On a phone the docked standings would cover the map, so they fold into this chip. -->
					<button class="chip phone-only" onclick={() => (showStandings = !showStandings)}>Standings</button>
					<a class="chip" href={signInHref}>Sign in</a>
				{/if}
```

- [ ] **Step 4: Standings as a snippet, docked for visitors**

Replace the whole `{#if showStandings} <aside class="drawer"> … </aside> {/if}` block with:

```svelte
	{#snippet standingsList()}
		<h2>Standings</h2>
		<ol>
			{#each s.standings as row, i (row.id)}
				{@const w = wb.get(row.id)}
				{#if w}
					<li>
						<span class="rank">{i + 1}</span>
						<!-- The faction's symbol, never the player's portrait. -->
						<Portrait name={w.player} portrait={null} symbol={w.symbol} faction={w.faction} seal={w.seal} size={34} />
						<a href="/players/{w.id}" class="who"><strong>{w.player}</strong><small>{w.name}</small></a>
						<span class="score"><strong>{row.total}</strong><small>{w.games}/{s.campaign.gamesPerPlayer}</small></span>
					</li>
				{/if}
			{/each}
		</ol>
		<a href="/players">Full standings →</a>
	{/snippet}

	{#if !signedIn}
		<aside class="dock" aria-label="Standings">{@render standingsList()}</aside>
	{/if}
	{#if showStandings}
		<aside class="drawer">{@render standingsList()}</aside>
	{/if}
```

- [ ] **Step 5: Styles**

1. Change the `.drawer` selector group so the dock shares it. Replace

```css
	.drawer {
		position: absolute;
		z-index: 3;
```

with

```css
	.drawer,
	.dock {
		position: absolute;
		z-index: 3;
```

and add after that rule:

```css
	/* Docked standings sit under the book-page sheets, which lay over them. */
	.dock {
		z-index: 2;
	}
	.phone-only {
		display: none;
	}
	.bar.guest {
		padding-left: 0;
	}
```

2. Change `.drawer h2`, `.drawer ol` and `.drawer li` to `.drawer h2, .dock h2`, `.drawer ol, .dock ol` and `.drawer li, .dock li`.

3. Move the omen to the bottom-left, clear of the dock. In `.omen`, replace `right: 14px;` with `left: 14px;`.

4. Add at the end of the `<style>` block:

```css
	@media (max-width: 40rem) {
		.dock {
			display: none;
		}
		.phone-only {
			display: inline-flex;
		}
	}
```

- [ ] **Step 6: Update DESIGN.md**

In the **Navigation panel** bullet, replace `carrying every link for player and Campaign Master alike` with `carrying every link for signed-in players and the Campaign Master alike; visitors who have not signed in get no panel, only a "← The live map" link on reading pages`. Then add this bullet after the **Sky switch** bullet from Task 5:

```markdown
- **Visitor map:** signed out, the live map shows the band (lockup, battle strip, live dot and a **Sign in** chip), the sky switch and the standings docked on the right (22rem, the drawer's ruled list, faction symbols instead of portraits). Book-page sheets lay over the dock. Below 40rem the dock folds into a Standings chip. The map-wide omen sits at the bottom-left.
```

- [ ] **Step 7: Type-check and try it**

Run: `cd app && npm run check 2>&1 | tail -3 && npm test`
Expected: no new check errors; tests pass.

In a private window (signed out), at http://localhost:5173/:
- There is no navigation handle or panel. The band shows the lockup, the battle strip (when a battle exists), the live dot and **Sign in**. **Clear skies** is at the top-left of the map, and the standings are docked on the right with faction symbols.
- Clicking a zone opens its sheet over the standings; closing it shows them again.
- "Read the lore →" opens the zone page with "← The live map" at the top, which returns to the map.
- **Sign in** goes to `/login?next=%2F`.
- At 390px wide the dock is gone and a **Standings** chip opens the drawer.
- With a map-wide weather event set (Admin → Weather), the omen reads at the bottom-left and nothing covers it.

Signed in: the panel, the Standings toggle and the drawer behave as before, and the drawer rows show faction symbols.

- [ ] **Step 8: Commit**

```bash
git add "app/src/routes/(public)/+layout.svelte" "app/src/routes/(public)/+page.svelte" DESIGN.md
git commit -m "feat: signed-out map with docked standings and a sign-in chip" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Whole-feature check

**Files:** none new; fix anything found in the task that owns it.

- [ ] **Step 1: Automated checks**

Run: `cd app && npm test && npm run check 2>&1 | tail -3`
Expected: all tests pass; `svelte-check` counts no higher than the Task 1 baseline.

- [ ] **Step 2: The race from Review Focus 5**

File a sign-up request for `ghost`. As the Campaign Master, create an account `ghost` under **New account**, then press **Approve** on the request.
Expected: the message reads `"ghost" is already an account. Decline this request instead.` and the request stays listed. **Decline** removes it.

- [ ] **Step 3: The walkthrough from the spec**

At desktop width and at 390px:
- The map signed out: docked standings (phone: the chip), only Sign in, and Clear skies / Satellite view toggling.
- The map signed in: the panel, the Standings toggle and the sky switch.
- The login page's three tabs, with a failed and a successful submission of each.
- The Campaign Master approves a sign-up and resolves a reset, then the new account signs in.

Expected: every item behaves as the spec says. Anything that doesn't is fixed and committed in its owning task's files with a `fix:` commit.
