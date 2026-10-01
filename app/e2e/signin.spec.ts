import { expect, test } from '@playwright/test';
import { BASE, CM, action, api, client, freshIp, makePlayer, signInPage, signedIn, uid, userId } from './helpers';

const NO_MATCH = 'That username and password do not match, or the account is disabled.';

test('the Campaign Master signs in at their own door and lands on the console', async ({ browser }) => {
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await page.goto('/admin');
	await page.waitForURL('**/admin/login?next=%2Fadmin');
	await signInPage(page, CM.username, CM.password);
	await page.waitForURL('**/admin');
	await ctx.close();
});

test('each door lets only its own accounts through, with the same answer as a wrong password', async () => {
	const cm = await signedIn(CM.username, CM.password);
	const p = await makePlayer(cm);
	const atPlayers = await action(await api(), '/login', 'signin', { username: CM.username, password: CM.password });
	expect(atPlayers.status).toBe(401);
	expect(atPlayers.data?.message).toBe(NO_MATCH);
	const atAdmin = await action(await api(), '/admin/login', 'default', { username: p.username, password: p.password });
	expect(atAdmin.status).toBe(401);
	expect(atAdmin.data?.message).toBe(NO_MATCH);
	await cm.dispose();
});

test('guessing at the Campaign Master from one address never locks the CM out', async () => {
	const guesser = await api(freshIp());
	for (let i = 0; i < 5; i++) await action(guesser, '/admin/login', 'default', { username: CM.username, password: `guess-${i}` });
	expect((await action(guesser, '/admin/login', 'default', { username: CM.username, password: 'guess-6' })).status).toBe(429);
	// The guesser is held up; the Campaign Master, from their own address, walks straight in.
	await (await signedIn(CM.username, CM.password)).dispose();
	await guesser.dispose();
});

test('a wrong password and an unknown account get the same answer', async ({ browser }) => {
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await signInPage(page, CM.username, 'not-the-password');
	await expect(page.getByRole('alert')).toHaveText(NO_MATCH);
	expect(new URL(page.url()).pathname).toBe('/admin/login');
	await signInPage(page, 'nobody-at-all', 'whatever-123');
	await expect(page.getByRole('alert')).toHaveText(NO_MATCH);
	expect(new URL(page.url()).pathname).toBe('/login');
	await ctx.close();
});

test('a disabled account cannot sign in', async () => {
	const cm = await signedIn(CM.username, CM.password);
	const p = await makePlayer(cm);
	await action(cm, '/admin/players', 'toggle', { id: await userId(cm, p.username) });
	const r = await action(await api(), '/login', 'signin', { username: p.username, password: p.password });
	expect(r.type).toBe('failure');
	expect(r.data?.message).toBe(NO_MATCH);
	await cm.dispose();
});

test('the sixth attempt in a minute from one address is turned away', async () => {
	// A throwaway name: failures also count against the account, and the Campaign Master is needed by the next tests.
	const ctx = await api(freshIp());
	const name = uid('lock');
	for (let i = 0; i < 5; i++) expect((await action(ctx, '/login', 'signin', { username: name, password: `wrong-${i}` })).status).toBe(401);
	const sixth = await action(ctx, '/login', 'signin', { username: name, password: 'wrong-6' });
	expect(sixth.status).toBe(429);
	expect(String(sixth.data?.message)).toMatch(/Too many attempts/);
	await ctx.dispose();
});

test('after signing in, back to where the visitor was going; another site is ignored', async ({ browser }) => {
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await signInPage(page, CM.username, CM.password, { next: '/zones' });
	await page.waitForURL('**/zones');
	await ctx.close();
	const other = await client(browser);
	const p2 = await other.newPage();
	await signInPage(p2, CM.username, CM.password, { next: 'https://evil.example/steal' });
	await p2.waitForURL('**/admin');
	expect(new URL(p2.url()).origin).toBe(new URL(BASE).origin);
	await other.close();
});

test('remember me keeps the session 30 days; unticked it ends with the browser', async ({ browser }) => {
	const kept = await client(browser);
	const page = await kept.newPage();
	await signInPage(page, CM.username, CM.password);
	await page.waitForURL('**/admin');
	const cookie = (await kept.cookies()).find((c) => c.name === 'cf_session')!;
	const days = (cookie.expires - Date.now() / 1000) / 86400;
	expect(days).toBeGreaterThan(29);
	expect(cookie.httpOnly).toBe(true);
	await kept.close();

	const brief = await client(browser);
	const p2 = await brief.newPage();
	await signInPage(p2, CM.username, CM.password, { remember: false });
	await p2.waitForURL('**/admin');
	expect((await brief.cookies()).find((c) => c.name === 'cf_session')!.expires).toBe(-1);
	await brief.close();
});

test('signing out ends the session: the old cookie no longer opens anything', async ({ browser }) => {
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await signInPage(page, CM.username, CM.password);
	await page.waitForURL('**/admin');
	const old = (await ctx.cookies()).find((c) => c.name === 'cf_session')!.value;
	await page.request.post('/logout', { headers: { origin: BASE } });
	const replay = await api();
	const res = await replay.get('/admin', { headers: { cookie: `cf_session=${old}` }, maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers().location).toMatch(/^\/admin\/login/);
	await ctx.close();
});

test('the .env account: its password is managed in .env, not in Settings', async ({ browser }) => {
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await signInPage(page, CM.username, CM.password);
	await page.waitForURL('**/admin');
	await page.goto('/settings');
	await expect(page.getByText('ADMIN_PASSWORD')).toBeVisible();
	await expect(page.getByLabel('Current password')).toHaveCount(0);
	await ctx.close();
});
