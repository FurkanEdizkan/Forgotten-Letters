/**
 * Step 1.5 shell flows end to end, each with its happy path and main error path: the left panel and the user menu,
 * the help pages, and the Owner's settings. Runs after accounts.e2e.ts on the same database, so the owner may exist
 * already; alone, it creates the owner through the setup API (what the wizard's Finish posts).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };

let lastIp = 100;
async function visitor(browser: Browser, viewport = { width: 1366, height: 768 }) {
	const ctx = await browser.newContext({
		viewport,
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.1.${++lastIp}` }
	});
	return ctx.newPage();
}

async function signIn(page: Page) {
	await page.goto('/login');
	await page.fill('input[name=username]', OWNER.username);
	await page.fill('input[name=password]', OWNER.password);
	await page.click('button[type=submit]');
	await page.waitForURL('/owner');
}

test.beforeAll(async ({ browser }) => {
	const page = await visitor(browser);
	const made = await page.context().request.post('/api/v1/setup', {
		data: {
			username: OWNER.username,
			displayName: 'Brother Anselm',
			password: OWNER.password,
			textScale: 100,
			accent: 'blood',
			port: 4173
		}
	});
	// 201: made now; 409: accounts.e2e.ts made it first.
	expect([201, 409]).toContain(made.status());
	await page.context().close();
});

test('shell: the panel starts closed on a laptop, opens, remembers, and Esc closes the menu before it', async ({
	browser
}) => {
	const page = await visitor(browser);
	await signIn(page);
	const toggle = page.getByRole('button', { name: 'Menu', exact: true });
	const panel = page.locator('#fl-panel');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(panel).toBeHidden();

	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(panel.getByRole('navigation', { name: 'Areas' })).toBeVisible();
	await expect(panel.getByRole('link', { name: 'People' })).toHaveAttribute('aria-current', 'page');
	await expect(panel.getByRole('link', { name: 'Licence' })).toBeVisible();

	// The choice outlives a reload.
	await page.reload();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await expect(panel).toBeVisible();

	// One Esc closes the user menu only; the next one the panel.
	await page.getByRole('button', { name: 'Account menu for Brother Anselm' }).click();
	await expect(page.getByText('Signed in as warden · Owner')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('menu')).toBeHidden();
	await expect(panel).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(panel).toBeHidden();
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');

	// User settings leads to the account page.
	await page.getByRole('button', { name: 'Account menu for Brother Anselm' }).click();
	await page.getByRole('menuitem', { name: 'User settings' }).click();
	await expect(page).toHaveURL(/\/account$/);
	await page.context().close();
});

test('shell: the panel starts open on a full-HD window; Log out ends the session', async ({
	browser
}) => {
	const page = await visitor(browser, { width: 1920, height: 1080 });
	await signIn(page);
	await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(page.locator('#fl-panel')).toBeVisible();

	await page.getByRole('button', { name: 'Account menu for Brother Anselm' }).click();
	await page.getByRole('menuitem', { name: 'Log out' }).click();
	await page.waitForURL('/login');
	await page.goto('/owner');
	await expect(page).toHaveURL(/\/login/);
	await page.context().close();
});

test('help pages: open signed out and signed in; an unknown page is a 404', async ({ browser }) => {
	const page = await visitor(browser);
	await page.goto('/help/licence');
	await expect(page.getByRole('heading', { name: 'Licence', level: 1 })).toBeVisible();
	await expect(page.getByText('This page is coming in a later step.')).toBeVisible();
	await expect(page.getByText('free software under the AGPL-3.0')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();

	const missing = await page.goto('/help/nothing-here');
	expect(missing?.status()).toBe(404);

	await signIn(page);
	await page.getByRole('link', { name: 'Docs' }).click();
	await expect(page).toHaveURL(/\/help\/docs$/);
	await expect(page.getByRole('heading', { name: 'Docs', level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Account menu for Brother Anselm' })).toBeVisible();
	await page.context().close();
});

test('owner settings: a new accent applies to every page; a low port is refused with the reason', async ({
	browser
}) => {
	const page = await visitor(browser);
	await signIn(page);
	await page.goto('/owner/settings');
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-accent', 'blood');

	await page.getByLabel('Verdigris').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Settings saved.')).toBeVisible();
	await expect(html).toHaveAttribute('data-accent', 'verdigris');
	// Rendered on the server too: a fresh load of another page starts with it.
	await page.goto('/home');
	await expect(html).toHaveAttribute('data-accent', 'verdigris');

	await page.goto('/owner/settings');
	await page.fill('input[name=port]', '80');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText(/Port 1023 and below need admin rights/)).toBeVisible();
	await expect(page.locator('input[name=port]')).toHaveAttribute('aria-invalid', 'true');

	// Put the look back for later runs on the same database.
	await page.fill('input[name=port]', '4173');
	await page.getByLabel('Blood').check();
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(html).toHaveAttribute('data-accent', 'blood');
	await page.context().close();
});
