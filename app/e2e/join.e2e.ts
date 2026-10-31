/**
 * Step 2 seat link flows end to end, each with its happy path and main error path: the CM makes a link (shown
 * once), a visitor creates an account on the join page and lands holding the seat, the used link is refused, an
 * existing user signs in on the join page for another seat, and unknown or withdrawn links say so. The owner runs
 * the campaign (Owners may create campaigns); it is made through the API, as the wizard's Create posts the same
 * service. Each visitor gets its own browser context and client address.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import postgres from 'postgres';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PASSWORD = 'seat-link-pass-123';
const NAME = 'Bleak Ford';

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.3.${++lastIp}` }
	});
	return ctx.newPage();
}

let cm: Page;
let campaignId = '';

test.beforeAll(async ({ browser }) => {
	cm = await visitor(browser);
	const api = cm.context().request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	// 201: made now; 409: an earlier file made it first.
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);

	const camp = await api.post('/api/v1/campaigns', {
		data: { name: NAME, kind: 'carcass_front', visibility: 'private', seats: 3 }
	});
	expect(camp.status()).toBe(201);
	campaignId = (await camp.json()).campaign.id;

	// An account that exists before it gets a seat link.
	const invite = await api.post('/api/v1/invites', { data: { role: 'user' } });
	const token = String((await invite.json()).link).split('/invite/')[1];
	const other = await visitor(browser);
	const accepted = await other.context().request.post(`/api/v1/invites/token/${token}/accept`, {
		data: { username: 'veteran', displayName: 'Old Gregor', password: PASSWORD }
	});
	expect(accepted.status()).toBe(201);
	await other.context().close();
});

/** Make the link for one seat on the manage page and read it from its one-time box. */
async function makeLink(seat: string) {
	await cm.goto(`/campaigns/${campaignId}/manage`);
	const row = cm.locator('tbody tr', { hasText: seat });
	await row.getByRole('button', { name: /^(Make link|New link)$/ }).click();
	const box = cm.getByLabel(`Link for ${seat}`);
	await expect(box).toHaveValue(/\/join\//);
	return box.inputValue();
}

test('seat link: a visitor creates an account and holds the seat; the same link again is used', async ({
	browser
}) => {
	const link = await makeLink('Seat 1');
	// Shown once: after a reload only "link out" is left.
	await cm.reload();
	await expect(cm.getByLabel('Link for Seat 1')).toHaveCount(0);
	await expect(cm.locator('tbody tr', { hasText: 'Seat 1' })).toContainText('link out');

	const page = await visitor(browser);
	await page.goto(link);
	await expect(page.getByRole('heading', { name: NAME, level: 1 })).toBeVisible();
	await expect(page.getByText("You're invited to take Seat 1.")).toBeVisible();
	await page.getByRole('tab', { name: 'Create an account' }).click();
	await page.getByLabel('Username').fill('recruit');
	await page.getByLabel('Display name').fill('Recruit Jakob');
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account and take the seat' }).click();
	await page.waitForURL(`/campaigns/${campaignId}`);
	await expect(page.getByText('Recruit Jakob (you)')).toBeVisible();

	const late = await visitor(browser);
	await late.goto(link);
	await expect(late.getByRole('heading', { name: 'Link already used' })).toBeVisible();
	await expect(late.getByText(`This seat in ${NAME} is taken.`, { exact: false })).toBeVisible();
	await expect(late.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
});

test('seat link: an existing user signs in on the join page and takes another seat; a wrong password stays', async ({
	browser
}) => {
	const link = await makeLink('Seat 2');
	const page = await visitor(browser);
	await page.goto(link);
	await expect(page.getByText("You're invited to take Seat 2.")).toBeVisible();

	await page.getByLabel('Username').fill('veteran');
	await page.getByLabel('Password').fill('not-the-password-1');
	await page.getByRole('button', { name: 'Sign in and take the seat' }).click();
	await expect(page.getByText('Wrong username or password.')).toBeVisible();
	await expect(page).toHaveURL(link);

	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in and take the seat' }).click();
	await page.waitForURL(`/campaigns/${campaignId}`);
	await expect(page.getByText('Old Gregor (you)')).toBeVisible();

	await cm.goto(`/campaigns/${campaignId}/manage`);
	await expect(cm.locator('tbody tr').nth(0)).toContainText('Recruit Jakob');
	await expect(cm.locator('tbody tr').nth(1)).toContainText('Old Gregor');
});

test('seat link: an unknown token and a withdrawn link say they do not work', async ({
	browser
}) => {
	const page = await visitor(browser);
	await page.goto('/join/this-token-does-not-exist');
	await expect(page.getByRole('heading', { name: 'This link does not work' })).toBeVisible();
	await expect(page.getByText('Ask the Campaign Master for a new link.')).toBeVisible();

	// A new link replaces the old one; the old one stops working.
	const old = await makeLink('Seat 3');
	await makeLink('Seat 3');
	await page.goto(old);
	await expect(page.getByRole('heading', { name: 'Link withdrawn' })).toBeVisible();
	await expect(page.getByRole('button', { name: /take the seat/i })).toHaveCount(0);
	await expect(page.getByText('Ask the Campaign Master for a new link.')).toBeVisible();
});

test('seat link: an expired link says so and offers no seat', async ({ browser }) => {
	const link = await makeLink('Seat 3');
	// Seven days cannot pass in a test: age the link in the test database (its hash, as the app stores it).
	const token = link.split('/join/')[1] ?? '';
	const sql = postgres(readFileSync(new URL('./.state/db-url', import.meta.url), 'utf8').trim(), {
		max: 1,
		onnotice: () => {}
	});
	try {
		const hash = createHash('sha256').update(token).digest('hex');
		await sql`update campaign.seat_invites set expires_at = now() - interval '1 day' where token_hash = ${hash}`;
	} finally {
		await sql.end();
	}
	const page = await visitor(browser);
	await page.goto(link);
	await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible();
	await expect(page.getByRole('button', { name: /take the seat/i })).toHaveCount(0);
});
