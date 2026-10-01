import { expect, test } from '@playwright/test';
import { BASE, CM, MODE, action, api, client, pageData, signedIn } from './helpers';

/** What a signed-out visitor can reach, in the mode this stack runs in (ACCESS=open | private). */
const pages = ['/players', '/zones', '/compendium', '/history'];

/** The first bytes of a server-sent event stream, without waiting for it to end (it never does). */
async function streamStatus(path: string, cookie?: string) {
	const ctl = new AbortController();
	const res = await fetch(BASE + path, { headers: { 'x-forwarded-for': '10.99.0.1', ...(cookie ? { cookie } : {}) }, signal: ctl.signal });
	let first = '';
	if (res.ok && res.body) {
		const reader = res.body.getReader();
		const { value } = await reader.read();
		first = new TextDecoder().decode(value);
	}
	ctl.abort();
	return { status: res.status, first };
}

test.describe('open mode: anyone on the network watches', () => {
	test.skip(MODE !== 'open', 'open mode only');

	test('the guest map: the campaign, the standings, and a way to sign in', async ({ browser }) => {
		const ctx = await client(browser);
		const page = await ctx.newPage();
		await page.goto('/');
		await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible();
		await ctx.close();
	});

	test('read-only pages open; the admin asks for a sign-in', async ({ browser }) => {
		const ctx = await client(browser);
		const page = await ctx.newPage();
		for (const p of pages) {
			const res = await page.goto(p);
			expect(res?.status(), p).toBe(200);
			expect(new URL(page.url()).pathname, p).toBe(p);
		}
		await page.goto('/admin/games');
		expect(new URL(page.url()).pathname).toBe('/admin/login');
		expect(new URL(page.url()).searchParams.get('next')).toBe('/admin/games');
		await ctx.close();
	});

	test('the live stream is open and never carries Vision cards', async () => {
		const { status, first } = await streamStatus('/api/stream');
		expect(status).toBe(200);
		expect(first).not.toMatch(/visionCard/);
	});
});

test.describe('private mode: signed out, only the door', () => {
	test.skip(MODE !== 'private', 'private mode only');

	test('every page sends a visitor to the sign-in page, keeping where they were going', async ({ browser }) => {
		const ctx = await client(browser);
		const page = await ctx.newPage();
		for (const p of ['/', ...pages]) {
			await page.goto(p);
			const url = new URL(page.url());
			expect(url.pathname, p).toBe('/login');
			expect(url.searchParams.get('next'), p).toBe(p);
		}
		await expect(page.getByText('This campaign is private')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to the map' })).toHaveCount(0);
		// The Campaign Master's door stays open too.
		await page.goto('/admin');
		expect(new URL(page.url()).pathname).toBe('/admin/login');
		await expect(page.getByText("The Campaign Master's door")).toBeVisible();
		await ctx.close();
	});

	test('data answers 401: the live stream, the round, uploads', async () => {
		expect((await streamStatus('/api/stream')).status).toBe(401);
		const anon = await api();
		for (const p of ['/api/round', '/uploads/anything.webp']) expect((await anon.get(p)).status(), p).toBe(401);
		const post = await anon.post('/warbands/x?/rename', { form: { name: 'x' }, headers: { 'x-sveltekit-action': 'true', origin: BASE } });
		expect(post.status()).toBe(401);
		await anon.dispose();
	});

	test('an invite link still works for someone with no account yet', async ({ browser }) => {
		const cm = await signedIn(CM.username, CM.password);
		const { seats } = await pageData<{ seats: { playerId: string; account: unknown }[] }>(cm, '/admin/muster');
		const free = seats.find((s) => !s.account)!;
		const r = await action(cm, '/admin/muster', 'invite', { player: free.playerId });
		const url = (r.data!.invite as { url: string }).url;
		const ctx = await client(browser);
		const page = await ctx.newPage();
		await page.goto(new URL(url).pathname);
		expect(new URL(page.url()).pathname).toMatch(/^\/join\//);
		await expect(page.getByLabel('Username')).toBeVisible();
		await action(cm, '/admin/muster', 'revoke', { invite: (await pageData<{ seats: { playerId: string; invite: { id: string } | null }[] }>(cm, '/admin/muster')).seats.find((s) => s.playerId === free.playerId)!.invite!.id });
		await ctx.close();
		await cm.dispose();
	});

	test('signed in, the campaign opens', async () => {
		const cm = await signedIn(CM.username, CM.password);
		for (const p of ['/', ...pages]) expect((await cm.get(p, { maxRedirects: 0 })).status(), p).toBe(200);
		const cookie = (await cm.storageState()).cookies.map((c) => `${c.name}=${c.value}`).join('; ');
		expect((await streamStatus('/api/stream', cookie)).status).toBe(200);
		await cm.dispose();
	});
});
