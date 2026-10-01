import { expect, test } from '@playwright/test';
import { CM, action, api, client, pageData, signInPage, signedIn, uid } from './helpers';

type Pending = { requests: { id: string; kind: string; username: string }[] };

test('a sign-up request: approved, the visitor signs in with the password they chose', async ({ browser }) => {
	const username = uid('s');
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await page.goto('/login?tab=signup');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password', { exact: true }).fill('my-own-pass-1');
	await page.getByLabel('Password again').fill('my-own-pass-1');
	await page.getByRole('button', { name: 'Request an account' }).click();
	await expect(page.getByRole('status')).toContainText('Sent to the Campaign Master');
	// Not yet approved: no way in.
	expect((await action(await api(), '/login', 'signin', { username, password: 'my-own-pass-1' })).status).toBe(401);

	const cm = await signedIn(CM.username, CM.password);
	const req = (await pageData<Pending>(cm, '/admin/players')).requests.find((r) => r.username === username)!;
	expect((await action(cm, '/admin/players', 'approve', { id: req.id })).type).toBe('success');
	await signInPage(page, username, 'my-own-pass-1');
	await page.waitForURL((u) => u.pathname === '/');
	await ctx.close();
	await cm.dispose();
});

test('a declined request cannot sign in', async () => {
	const username = uid('d');
	const anon = await api();
	expect((await action(anon, '/login', 'signup', { username, password: 'declined-pass', confirm: 'declined-pass' })).type).toBe('success');
	const cm = await signedIn(CM.username, CM.password);
	const req = (await pageData<Pending>(cm, '/admin/players')).requests.find((r) => r.username === username)!;
	await action(cm, '/admin/players', 'decline', { id: req.id });
	expect((await action(await api(), '/login', 'signin', { username, password: 'declined-pass' })).status).toBe(401);
	await cm.dispose();
});

test('a reset request: the Campaign Master issues a temporary password, which must be replaced', async ({ browser }) => {
	const cm = await signedIn(CM.username, CM.password);
	const username = uid('r');
	await action(cm, '/admin/players', 'create', { username, password: 'forgotten-pass' });
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await page.goto('/login?tab=reset');
	await page.getByLabel('Username').fill(username);
	await page.getByRole('button', { name: 'Ask for a reset' }).click();
	await expect(page.getByRole('status')).toContainText('has been asked to reset it');
	const req = (await pageData<Pending>(cm, '/admin/players')).requests.find((r) => r.username === username && r.kind === 'reset')!;
	const issued = (await action(cm, '/admin/players', 'resolveReset', { id: req.id })).data!.issued as { password: string };
	await signInPage(page, username, issued.password);
	await page.waitForURL('**/settings?first=1');
	await ctx.close();
	await cm.dispose();
});
