/**
 * Step 2 campaign flows end to end, each with its happy path and main error path: the creation wizard, filling a
 * seat by name, asking to join and approving, stage moves, delete and restore. Runs after the step 1 files on the
 * same database, so the owner may exist already; alone, it creates the owner through the setup API. The Admin who
 * runs the campaigns and the Users who join are made through the invite API, which the invite page posts to.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PASSWORD = 'campaign-flow-pass-1';
const NAME = 'Ashen Vigil';

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.2.${++lastIp}` }
	});
	return ctx.newPage();
}

/** A new account of `role`, invited by the owner and signed in in its own context. */
async function account(
	browser: Browser,
	owner: Page,
	role: 'admin' | 'user',
	username: string,
	displayName: string
) {
	const made = await owner.context().request.post('/api/v1/invites', { data: { role } });
	expect(made.status()).toBe(201);
	const token = String((await made.json()).link).split('/invite/')[1];
	const page = await visitor(browser);
	const accepted = await page.context().request.post(`/api/v1/invites/token/${token}/accept`, {
		data: { username, displayName, password: PASSWORD }
	});
	expect(accepted.status()).toBe(201);
	return page;
}

let admin: Page;
let pilgrim: Page;
let campaignId = '';
let hiddenId = '';

test.beforeAll(async ({ browser }) => {
	const owner = await visitor(browser);
	const api = owner.context().request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	// 201: made now; 409: an earlier file made it first.
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);

	admin = await account(browser, owner, 'admin', 'marta', 'Sister Marta');
	pilgrim = await account(browser, owner, 'user', 'pilgrim', 'Brother Odo');
	await account(browser, owner, 'user', 'scout', 'Scout Hendrik');

	// A private campaign, for the error path of asking to join.
	const hidden = await admin.context().request.post('/api/v1/campaigns', {
		data: { name: 'Hidden Cellar', kind: 'generic', visibility: 'private', seats: 2 }
	});
	expect(hidden.status()).toBe(201);
	hiddenId = (await hidden.json()).campaign.id;
	await owner.context().close();
});

/** Walk the wizard from Basics to Review with a name; the other steps keep their defaults, plus one rule. */
async function walkWizard(page: Page, name: string) {
	await page.goto('/campaigns');
	await page.getByRole('link', { name: 'New campaign' }).first().click();
	await expect(page).toHaveURL(/\/campaigns\/new$/);
	const next = page.getByRole('button', { name: 'Next' });

	// Basics: Next with no name stays on the step with the reason.
	await next.click();
	await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute('aria-invalid', 'true');
	await page.getByLabel('Name', { exact: true }).fill(name);
	await page.getByLabel('Short description').fill('A winter campaign along the flooded line.');
	await next.click();

	await expect(page.getByRole('heading', { name: 'Schedule and visibility' })).toBeVisible();
	await page.getByLabel('Games per player (1 to 50)').fill('6');
	await next.click();

	await expect(page.getByRole('heading', { name: 'Seats', exact: true })).toBeVisible();
	await page.getByLabel('Number of seats').fill('4');
	await next.click();

	await expect(page.getByRole('heading', { name: 'House rules', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Add Write your own' }).click();
	await page.getByLabel('Name of rule 1').fill('Short nights');
	await page.getByLabel('Note for rule 1').fill('Games end after four turns.');
	await next.click();

	await expect(page.getByRole('heading', { name: 'Map' })).toBeVisible();
	await page.getByRole('button', { name: 'Skip' }).click();

	await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
	await expect(page.getByText('4 (Seat 1 to Seat 4)')).toBeVisible();
	await expect(page.getByText('1 rule, 1 on: Short nights')).toBeVisible();
	await page.getByRole('button', { name: 'Create campaign' }).click();
}

test('wizard: an Admin creates a campaign through every step; a taken name returns to Basics', async () => {
	await walkWizard(admin, NAME);
	await admin.waitForURL(/\/campaigns\/[0-9a-f-]+\/manage\?created=1$/);
	campaignId = new URL(admin.url()).pathname.split('/')[2]!;
	await expect(admin.getByRole('heading', { name: NAME, level: 1 })).toBeVisible();
	await expect(admin.getByText(/^Campaign created\./)).toBeVisible();
	await expect(admin.getByRole('list', { name: 'Seats' }).getByRole('listitem')).toHaveCount(4);

	// The same name again, in another case: the wizard goes back to Basics with the reason under the field.
	await walkWizard(admin, NAME.toUpperCase());
	const name = admin.getByLabel('Name', { exact: true });
	await expect(name).toBeVisible();
	await expect(name).toHaveAttribute('aria-invalid', 'true');
	await expect(name).toHaveAccessibleDescription(/That name is taken by another campaign\./);
	await expect(admin).toHaveURL(/\/campaigns\/new$/);
});

test('seats: the CM fills a seat by name; somebody not found gets the no-match note', async () => {
	await admin.goto(`/campaigns/${campaignId}/manage`);
	const finder = admin.getByLabel('Fill a seat by name');
	await finder.fill('nobody-here');
	await admin.getByRole('button', { name: 'Find' }).click();
	await expect(admin.getByText(/^Nobody matches\./)).toBeVisible();

	await finder.fill('scout');
	await admin.getByRole('button', { name: 'Find' }).click();
	await expect(admin.getByRole('radio', { name: /Scout Hendrik/ })).toBeChecked();
	await admin.getByLabel('Seat', { exact: true }).selectOption({ label: 'Seat 2' });
	await admin.getByRole('button', { name: 'Add to seat' }).click();
	await expect(admin.getByText('Added to the seat.')).toBeVisible();
	// A seat on its default name takes the player's display name.
	await expect(
		admin.getByRole('list', { name: 'Seats' }).getByRole('listitem').nth(1)
	).toContainText('Scout Hendrik');
});

test('house rules: the CM drags a preset in, sets a value and players see it; a value out of range is refused', async () => {
	await admin.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	const library = admin.getByRole('region', { name: 'Rule library' });
	const mine = admin.getByRole('region', { name: "This campaign's house rules" });
	await library
		.getByRole('group', { name: 'Trench depth' })
		.dragTo(mine.getByText('Drop a rule here'));
	const depth = mine.getByLabel('Depth (″)');
	await expect(depth).toHaveValue('3');
	await depth.fill('9');
	await admin.getByRole('button', { name: 'Save settings' }).click();
	await expect(admin.getByText('Use 1 to 4 inches.')).toBeVisible();

	await depth.fill('2');
	// Keyboard and click work like dragging.
	await library.getByRole('button', { name: 'Add Attacker before repeat' }).press('Enter');
	await expect(library.getByRole('group', { name: 'Attacker before repeat' })).toContainText(
		'Added'
	);
	// Dragging a rule back to the library removes it; pressing Add puts it back.
	await mine
		.getByRole('button', { name: 'Drag Attacker before repeat back to the library to remove it' })
		.dragTo(library.getByRole('group', { name: 'Starting glory' }));
	await expect(library.getByRole('button', { name: 'Add Attacker before repeat' })).toBeVisible();
	await library.getByRole('button', { name: 'Add Attacker before repeat' }).click();
	await admin.getByRole('button', { name: 'Save settings' }).click();
	await expect(admin.getByText('Settings saved.')).toBeVisible();

	await admin.goto(`/campaigns/${campaignId}`);
	await expect(admin.getByText('Depth: 2″', { exact: false })).toBeVisible();
	await expect(admin.getByText('Attacker before repeat')).toBeVisible();
});

test('seat links: Make links for empty seats, then Withdraw all links stops them all', async () => {
	await admin.goto(`/campaigns/${campaignId}/manage`);
	await admin.getByRole('button', { name: 'Make links for empty seats' }).click();
	const cards = admin.getByRole('list', { name: 'Seats' }).getByRole('listitem');
	await expect(cards.filter({ hasText: 'Link ready' }).first()).toBeVisible();
	await admin.getByRole('button', { name: 'Withdraw all links' }).click();
	await admin.getByRole('button', { name: 'Withdraw every link?' }).click();
	await expect(admin.getByText(/^Withdrew \d+ links?\./)).toBeVisible();
	await expect(cards.filter({ hasText: 'Link ready' })).toHaveCount(0);
	await expect(admin.getByRole('button', { name: 'Withdraw all links' })).toHaveCount(0);
});

test('saving stays in place: the page keeps its scroll and its tab', async () => {
	await admin.setViewportSize({ width: 1366, height: 600 });
	await admin.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	const save = admin.getByRole('button', { name: 'Save settings' });
	await save.scrollIntoViewIfNeeded();
	const before = await admin.evaluate(() => scrollY);
	expect(before).toBeGreaterThan(0);
	await save.click();
	await expect(admin.getByText('Settings saved.')).toBeVisible();
	expect(await admin.evaluate(() => scrollY)).toBeGreaterThan(before / 2);
	await expect(admin).toHaveURL(/tab=settings/);
	await admin.setViewportSize({ width: 1366, height: 768 });
});

test('requests: a User asks to join a listed campaign and the CM approves; a private one is not offered', async () => {
	await pilgrim.goto('/campaigns');
	await expect(pilgrim.getByRole('heading', { name: 'Listed campaigns' })).toBeVisible();
	await expect(pilgrim.getByRole('heading', { name: 'Hidden Cellar' })).toHaveCount(0);
	// Opened by its address, it neither shows itself nor offers a request (the status code: see the last test).
	await pilgrim.goto(`/campaigns/${hiddenId}`);
	await expect(pilgrim.getByText('Hidden Cellar')).toHaveCount(0);
	await expect(pilgrim.getByRole('button', { name: 'Ask to join' })).toHaveCount(0);

	await pilgrim.goto('/campaigns');
	const card = pilgrim.locator('article', { hasText: NAME });
	await card.getByRole('button', { name: 'Ask to join' }).click();
	await card.getByLabel('Note for the CM').fill('I bring a pilgrim warband.');
	await card.getByRole('button', { name: 'Send request' }).click();
	await expect(card.getByRole('button', { name: 'Request sent' })).toBeDisabled();

	await admin.goto(`/campaigns/${campaignId}/manage?tab=requests`);
	const request = admin.locator('li', { hasText: 'Brother Odo' });
	await expect(request).toContainText('I bring a pilgrim warband.');
	await request.getByRole('button', { name: 'Approve' }).click();
	await expect(admin.getByText(/^No open requests\./)).toBeVisible();

	await pilgrim.goto('/campaigns');
	const mine = pilgrim.locator('section', { hasText: 'Your campaigns' });
	await expect(mine.getByRole('link', { name: NAME })).toBeVisible();
	await pilgrim.goto(`/campaigns/${campaignId}`);
	await expect(pilgrim.getByText('(you)')).toBeVisible();
});

test('stages: mustering to active refuses seat links; back to mustering opens them again', async () => {
	await admin.goto(`/campaigns/${campaignId}/manage`);
	await admin.getByRole('button', { name: 'Start the campaign' }).click();
	await expect(admin.getByRole('button', { name: 'Back to mustering' })).toBeVisible();
	await expect(
		admin.getByText('Seat links work only while the campaign is mustering.')
	).toBeVisible();
	await expect(admin.getByRole('button', { name: 'Make links for empty seats' })).toHaveCount(0);
	const refused = await admin.context().request.post(`/api/v1/campaigns/${campaignId}/seat-links`);
	expect(refused.status()).toBe(409);

	await admin.getByRole('button', { name: 'Back to mustering' }).click();
	await expect(admin.getByRole('button', { name: 'Start the campaign' })).toBeVisible();
	await expect(admin.getByRole('button', { name: 'Make links for empty seats' })).toBeVisible();
});

/** Press Restore on a deleted card and wait for the action's answer. */
async function restore(page: Page, name: string) {
	await page.goto('/campaigns?view=deleted');
	const answer = page.waitForResponse(
		(r) => r.request().method() === 'POST' && r.url().endsWith('/restore')
	);
	await page.locator('article', { hasText: name }).getByRole('button', { name: 'Restore' }).click();
	return (await answer).json();
}

test('delete and restore: the CM deletes and restores; a name taken meanwhile blocks the restore', async () => {
	await admin.goto(`/campaigns/${campaignId}/manage`);
	await admin.getByRole('tab', { name: 'Danger' }).click();
	await admin.getByRole('button', { name: 'Delete campaign' }).click();
	await admin.getByRole('button', { name: 'Delete for good?' }).click();
	await admin.waitForURL('/campaigns?view=deleted');
	await expect(admin.locator('article', { hasText: NAME })).toContainText(/deleted /);
	expect((await restore(admin, NAME)).type).toBe('success');
	await admin.goto('/campaigns');
	await expect(
		admin.locator('section', { hasText: 'Your campaigns' }).getByRole('link', { name: NAME })
	).toBeVisible();

	// Error path: the private campaign is deleted, a new one takes its name, so it cannot come back as it was.
	const api = admin.context().request;
	expect((await api.delete(`/api/v1/campaigns/${hiddenId}`)).status()).toBe(204);
	const twin = await api.post('/api/v1/campaigns', {
		data: { name: 'Hidden Cellar', kind: 'generic', visibility: 'private', seats: 2 }
	});
	expect(twin.status()).toBe(201);
	const refused = await restore(admin, 'Hidden Cellar');
	expect(refused.type).toBe('failure');
	expect(refused.status).toBe(409);
	await admin.goto('/campaigns?view=deleted');
	await expect(admin.locator('article', { hasText: 'Hidden Cellar' })).toBeVisible();
});

// The Restore form posts to "?view=deleted&/restore" so the page stays on the Deleted view, the only place that shows
// "Campaign restored." and the restore error.
test('delete and restore: the Deleted view says "Campaign restored."', async () => {
	expect((await admin.context().request.delete(`/api/v1/campaigns/${campaignId}`)).status()).toBe(
		204
	);
	await restore(admin, NAME);
	await expect(admin.getByText('Campaign restored.')).toBeVisible({ timeout: 2000 });
});

// A campaign you may not see answers 404, not 500: page loads turn the service's AppError into the error page.
test('requests: a private campaign opened by a User who is not in it answers 404', async () => {
	const page = await pilgrim.goto(`/campaigns/${hiddenId}`);
	expect(page?.status()).toBe(404);
});
