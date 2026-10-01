import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { CM, action, client, pageData, signedIn, uid } from './helpers';

type Muster = { seats: { playerId: string; account: unknown; invite: { id: string } | null }[] };

async function invite(cm: Awaited<ReturnType<typeof signedIn>>) {
	const free = (await pageData<Muster>(cm, '/admin/muster')).seats.find((s) => !s.account)!;
	const r = await action(cm, '/admin/muster', 'invite', { player: free.playerId });
	return { seat: free.playerId, path: new URL((r.data!.invite as { url: string }).url).pathname };
}

test('an invite link: a new account, seated and signed in, and the link is spent', async ({ browser }) => {
	const cm = await signedIn(CM.username, CM.password);
	const { path } = await invite(cm);
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await page.goto(path);
	await page.getByLabel('Username').fill(uid('j'));
	await page.getByLabel('Password', { exact: true }).fill('joined-pass-1');
	await page.getByLabel('Password again').fill('joined-pass-1');
	await page.getByRole('button', { name: /join|take/i }).click();
	await page.waitForURL('**/muster');
	await ctx.close();
	const again = await client(browser);
	const p2 = await again.newPage();
	await p2.goto(path);
	await expect(p2.getByText('This invite has been used already')).toBeVisible();
	await again.close();
	await cm.dispose();
});

test('a withdrawn invite says so', async ({ browser }) => {
	const cm = await signedIn(CM.username, CM.password);
	const { seat, path } = await invite(cm);
	const id = (await pageData<Muster>(cm, '/admin/muster')).seats.find((s) => s.playerId === seat)!.invite!.id;
	await action(cm, '/admin/muster', 'revoke', { invite: id });
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await page.goto(path);
	await expect(page.getByText('This invite link was withdrawn')).toBeVisible();
	await ctx.close();
	await cm.dispose();
});

test('an expired invite says so', async ({ browser }) => {
	// Seven days can't pass in a test: age the invite in the test stack's own database (scripts/e2e.sh sets the folder).
	const stack = process.env.E2E_STACK_DIR;
	test.skip(!stack, 'needs the throwaway stack from scripts/e2e.sh');
	const cm = await signedIn(CM.username, CM.password);
	const { seat, path } = await invite(cm);
	const id = (await pageData<Muster>(cm, '/admin/muster')).seats.find((s) => s.playerId === seat)!.invite!.id;
	const sql = `update invite set expires_at = now() - interval '1 minute' where id = '${id.replace(/[^0-9a-f-]/g, '')}'`;
	execFileSync('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'carcass', '-d', 'carcass', '-c', sql], { cwd: stack });
	const ctx = await client(browser);
	const page = await ctx.newPage();
	await page.goto(path);
	await expect(page.getByText('This invite link has expired')).toBeVisible();
	await expect(page.getByLabel('Username')).toHaveCount(0);
	await ctx.close();
	await cm.dispose();
});
