/**
 * Step 3 flows end to end on the invented rules folders (e2e/server.js points RULES_DIR at them): the Owner sees
 * which folders loaded and why the broken one did not, and reloads; anyone signed in browses the compendium (a
 * faction, a unit, an item, a keyword pop-up), filters the Battlekit, follows the graph, and reads what changed
 * between two versions. Error paths: a version that is not loaded, and a filter that matches nothing.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };

let lastIp = 60;
async function owner(browser: Browser): Promise<Page> {
	const ctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.5.${++lastIp}` }
	});
	const page = await ctx.newPage();
	await page.goto('/login');
	await page.fill('input[name=username]', OWNER.username);
	await page.fill('input[name=password]', OWNER.password);
	await page.click('button[type=submit]');
	await page.waitForURL('/owner');
	return page;
}

test.beforeAll(async ({ browser }) => {
	const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.0.5.1' } });
	const made = await ctx.request.post('/api/v1/setup', {
		data: {
			username: OWNER.username,
			displayName: 'Brother Anselm',
			password: OWNER.password,
			textScale: 100,
			accent: 'blood',
			port: 4173
		}
	});
	// 201: made now; 409: an earlier file made it first.
	expect([201, 409]).toContain(made.status());
	await ctx.close();
});

test('rules data: the Owner sees the loaded folders and the broken one with its error, and reloads', async ({
	browser
}) => {
	const page = await owner(browser);
	await page.goto('/owner/rules');
	await expect(page.getByRole('heading', { name: 'Rules data' })).toBeVisible();
	await expect(page.locator('tr[data-set="core-1.0.2"]')).toContainText('Loaded');
	await expect(page.locator('tr[data-set="mire-front-1.0"]')).toContainText('core-1.0.2');
	const broken = page.locator('tr[data-set="broken-0.1"]');
	await expect(broken).toContainText('Not loaded');
	await expect(broken).toContainText('items.json');
	await expect(broken).toContainText('item:rusty-blade');
	await expect(broken).toContainText('kw:nowhere does not resolve');
	await page.getByRole('button', { name: 'Reload' }).click();
	await expect(page.getByText('Reloaded: 4 loaded, 1 not loaded.')).toBeVisible();
	await page.context().close();
});

test('compendium: a faction, a unit, an item and a keyword pop-up; a version not loaded is a 404', async ({
	browser
}) => {
	const page = await owner(browser);
	// Rules sits in the side panel for every role; it opens on the newest core version.
	await page.getByRole('button', { name: 'Menu', exact: true }).click();
	await page.locator('#fl-panel').getByRole('link', { name: 'Rules', exact: true }).click();
	await page.waitForURL('/rules/core-1.0.2/s/core-rules');
	await expect(page.getByRole('heading', { name: 'Core Rules', level: 1 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Moving' })).toBeVisible();

	const tree = page.getByRole('navigation', { name: 'Compendium sections' });
	await tree.getByRole('link', { name: 'Lantern Guild' }).click();
	await expect(page.getByRole('heading', { name: 'Lantern Guild', level: 1 })).toBeVisible();
	await expect(page.locator('[data-unit="unit:lantern-guild/warden"]')).toBeVisible();

	await page.locator('[data-unit="unit:lantern-guild/warden"] h3 a').click();
	await expect(page.getByRole('heading', { name: 'Warden', level: 1 })).toBeVisible();
	await page.getByRole('link', { name: 'Signal Lantern' }).first().click();
	await expect(page.getByRole('heading', { name: 'Signal Lantern', level: 1 })).toBeVisible();

	const chip = page.locator('.kw').filter({ hasText: 'Steady' }).first();
	await chip.hover();
	await expect(chip.getByRole('tooltip')).toBeVisible();
	await expect(chip.getByRole('tooltip')).toContainText('ignores the first shove');
	await page.keyboard.press('Escape');
	await expect(chip.getByRole('tooltip')).toBeHidden();

	const missing = await page.goto('/rules/core-9.9/s/core-rules');
	expect(missing?.status()).toBe(404);
	await expect(page.getByText('No rules set core-9.9 is loaded.')).toBeVisible();
	await page.context().close();
});

test('battlekit: filter by category and keyword; no match says so', async ({ browser }) => {
	const page = await owner(browser);
	// The page must hydrate: an item carrying the same keyword twice once broke a keyed list in the browser.
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.goto('/rules/core-1.0.2/battlekit');
	await expect(page.locator('[data-item="item:cudgel"]')).toContainText('Weighty 2');
	expect(errors).toEqual([]);
	await page.goto('/rules/core-1.0.2/battlekit?category=ranged');
	await expect(page.locator('[data-item="item:hook-rifle"]')).toBeVisible();
	await expect(page.locator('[data-item="item:cudgel"]')).toHaveCount(0);
	await expect(page.locator('[data-item="item:hook-rifle"]')).toContainText('Lantern Guild');

	await page.getByLabel('Category').selectOption('');
	await page.getByLabel('Keyword').selectOption({ label: 'Weighty' });
	await expect(page.locator('[data-item]')).toHaveCount(3);
	await expect(page.locator('[data-item="item:pike"]')).toBeVisible();

	await page.getByLabel('Filter by name').fill('nothing like this');
	await expect(page.getByText('No items match.')).toBeVisible();
	await page.context().close();
});

test('graph: clicking a node opens that element; the list carries the same links', async ({
	browser
}) => {
	const page = await owner(browser);
	await page.goto('/rules/core-1.0.2/e/unit%3Alantern-guild/warden?depth=2');
	const graph = page.getByTestId('rules-graph');
	await expect(graph).toBeVisible();
	await expect(
		page.getByRole('list', { name: 'Two steps' }).getByRole('link', { name: 'Steady' })
	).toBeVisible();
	await graph.locator('a[data-id="faction:lantern-guild"]').click();
	await page.waitForURL('/rules/core-1.0.2/e/faction%3Alantern-guild');
	await expect(page.getByRole('heading', { name: 'Lantern Guild', level: 1 })).toBeVisible();
	await page.context().close();
});

test('campaigns: tables whose rows share a roll still render without errors', async ({
	browser
}) => {
	const page = await owner(browser);
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
	await page.goto('/rules/core-1.0.2/s/campaigns');
	await expect(page.getByText('Old Charm')).toBeVisible();
	expect(errors).toEqual([]);
	await page.context().close();
});

test('errata: what changed between core 1.0.1 and 1.0.2', async ({ browser }) => {
	const page = await owner(browser);
	await page.goto('/rules/core-1.0.2/s/errata');
	await expect(page.getByRole('heading', { name: 'What changed between versions' })).toBeVisible();
	const rifle = page.locator('table[data-changed="item:hook-rifle"]');
	await expect(rifle).toContainText('range');
	await expect(rifle).toContainText('18"');
	await expect(rifle).toContainText('24"');
	await expect(page.locator('ul.added')).toContainText('Long Pike');
	await expect(page.locator('ul.removed')).toContainText('Ringing Bell');

	// Comparing a version with itself shows no changes.
	await page.getByLabel('From').selectOption('core-1.0.2');
	await page.getByRole('button', { name: 'Compare' }).click();
	await expect(page.getByText('These two versions hold the same elements.')).toBeVisible();
	await page.context().close();
});
