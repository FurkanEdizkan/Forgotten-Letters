import { expect, request as playwrightRequest, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { parse, unflatten } from 'devalue';

export const BASE = process.env.E2E_BASE ?? 'http://localhost:3200';
export const MODE = (process.env.E2E_ACCESS ?? 'open') as 'open' | 'private';
export const CM = { username: 'cm', password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-cm-password' };

/**
 * Every test comes from its own client address (the stack trusts X-Forwarded-For), so rate limits apply per test
 * as they would per visitor; the rate-limit test reuses one address on purpose.
 */
let n = Math.floor(Math.random() * 60_000); // a different range each run: buckets from a run a minute ago don't carry over
export const freshIp = () => `10.${20 + (Math.floor(++n / 62_500) % 200)}.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`;
export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(0, 30);

export async function client(browser: Browser, ip = freshIp(), viewport = { width: 1280, height: 860 }): Promise<BrowserContext> {
	return browser.newContext({ baseURL: BASE, extraHTTPHeaders: { 'x-forwarded-for': ip }, viewport });
}
export async function api(ip = freshIp()): Promise<APIRequestContext> {
	return playwrightRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { 'x-forwarded-for': ip, origin: BASE } });
}

/** A form action as the app's own enhanced forms post it; returns SvelteKit's result ({ type, status, data }). */
export async function action(ctx: APIRequestContext, path: string, name: string, fields: Record<string, string> = {}) {
	// A page's default action takes no ?/name.
	const url = name === 'default' ? path : `${path}?/${name}`;
	const res = await ctx.post(url, { form: fields, headers: { 'x-sveltekit-action': 'true', origin: BASE }, maxRedirects: 0 });
	const body = await res.json().catch(() => ({ type: 'error', status: res.status() }));
	return { ...body, data: body.data ? parse(body.data) : undefined } as { type: string; status: number; location?: string; data?: Record<string, unknown>; error?: unknown };
}

/** A page's server data, as SvelteKit sends it to the browser (the last node is the page's own). */
export async function pageData<T = Record<string, unknown>>(ctx: APIRequestContext, path: string): Promise<T> {
	const res = await ctx.get(`${path.replace(/\/$/, '')}/__data.json`);
	expect(res.ok(), `${path} data`).toBe(true);
	const { nodes } = (await res.json()) as { nodes: ({ type: string; data: unknown[] } | null)[] };
	const last = [...nodes].reverse().find((x) => x?.type === 'data');
	return unflatten(last!.data) as T;
}

/** The Campaign Master signs in at their own door; everyone else at /login. */
export const doorFor = (username: string) => (username === CM.username ? { path: '/admin/login', name: 'default' } : { path: '/login', name: 'signin' });

/** Sign in through the API (fixtures); returns the context, now carrying the session cookie. */
export async function signedIn(username: string, password: string, ip = freshIp()) {
	const ctx = await api(ip);
	const door = doorFor(username);
	const r = await action(ctx, door.path, door.name, { username, password, remember: 'on' });
	expect(r.type, `sign in ${username}`).toBe('redirect');
	return ctx;
}

/** Sign in through the page, as a person would. */
export async function signInPage(page: Page, username: string, password: string, opts: { next?: string; remember?: boolean } = {}) {
	const door = doorFor(username).path;
	await page.goto(opts.next ? `${door}?next=${encodeURIComponent(opts.next)}` : door);
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill(password);
	if (opts.remember === false) await page.getByLabel('Remember me on this device').uncheck();
	await page.getByRole('button', { name: 'Sign in' }).click();
}

/** A player account made by the Campaign Master (it must choose its own password at first sign-in). */
export async function makePlayer(cm: APIRequestContext, username = uid('p'), password = 'first-pass-123') {
	const r = await action(cm, '/admin/players', 'create', { username, password });
	expect(r.type, `create ${username}: ${JSON.stringify(r.data)}`).toBe('success');
	return { username, password };
}

export async function userId(cm: APIRequestContext, username: string) {
	const d = await pageData<{ users: { id: string; username: string }[] }>(cm, '/admin/players');
	return d.users.find((u) => u.username === username)!.id;
}

/** Sign in, then replace the temporary password: a ready player. */
export async function readyPlayer(cm: APIRequestContext) {
	const p = await makePlayer(cm);
	const ctx = await signedIn(p.username, p.password);
	const password = 'own-pass-12345';
	const r = await action(ctx, '/settings', 'password', { current: p.password, next: password, again: password });
	expect(r.type).toBe('redirect');
	return { username: p.username, password, ctx };
}
