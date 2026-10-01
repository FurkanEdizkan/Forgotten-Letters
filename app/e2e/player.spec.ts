import { expect, test } from '@playwright/test';
import { CM, client, makePlayer, readyPlayer, signInPage, signedIn } from './helpers';

test('a new player must choose a password before anything else', async ({ browser }) => {
	const cm = await signedIn(CM.username, CM.password);
	const p = await makePlayer(cm);
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await signInPage(page, p.username, p.password);
	await page.waitForURL('**/settings?first=1');
	await page.goto('/players');
	expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/settings?first=1');
	await page.getByLabel('The password you were given').fill(p.password);
	await page.getByLabel(/^New password/).first().fill('chosen-pass-123');
	await page.getByLabel('New password again').fill('chosen-pass-123');
	await page.getByRole('button', { name: 'Save password' }).click();
	await page.waitForURL('**/settings');
	const res = await page.goto('/players');
	expect(res?.status()).toBe(200);
	await ctx.close();
	await cm.dispose();
});

test('changing the password signs out every other device', async () => {
	const cm = await signedIn(CM.username, CM.password);
	const p = await readyPlayer(cm);
	const other = await signedIn(p.username, p.password);
	const r = await p.ctx.post('/settings?/password', {
		form: { current: p.password, next: 'newer-pass-123', again: 'newer-pass-123' },
		headers: { 'x-sveltekit-action': 'true', origin: process.env.E2E_BASE ?? 'http://localhost:3200' }
	});
	expect(r.ok()).toBe(true);
	const res = await other.get('/settings', { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	expect(res.headers().location).toMatch(/^\/login/);
	await cm.dispose();
});

test('a player opening the admin gets a plain refusal, not a redirect loop', async ({ browser }) => {
	const cm = await signedIn(CM.username, CM.password);
	const p = await readyPlayer(cm);
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await signInPage(page, p.username, p.password, { next: '/admin/games' });
	// A forbidden `next` lands at home instead.
	await page.waitForURL((u) => u.pathname === '/');
	const res = await page.goto('/admin/games');
	expect(res?.status()).toBe(403);
	await expect(page.getByText('Only the Campaign Master can open this.')).toBeVisible();
	const login = await page.goto('/login?next=%2Fadmin');
	expect(login?.status()).toBe(200);
	expect(new URL(page.url()).pathname).toBe('/');
	// "Sign in as someone else" signs the player out and opens the Campaign Master's door.
	await page.goto('/admin/games');
	await page.getByRole('button', { name: 'Sign in as someone else' }).click();
	await page.waitForURL((u) => u.pathname === '/admin/login' && u.searchParams.get('next') === '/admin/games');
	await ctx.close();
	await cm.dispose();
});
