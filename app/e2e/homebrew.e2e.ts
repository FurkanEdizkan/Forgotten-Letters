/**
 * Homebrew end to end on the invented rules folders: a player copies the Ash Wardens variant of core-1.0.2 as their
 * own, adds a unit (with a new keyword) and a new item with a keyword, sees the Checks panel name a problem and
 * clear it, saves, previews it in the compendium, and builds a warband on it. Putting that warband in a campaign
 * seat is refused until the CM allows that homebrew; another player cannot see the set until it is shared (and the
 * CM can only allow what they can see). A later draft with problems saves, and players keep the last version that
 * passed (the editor and the compendium say from when).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PASSWORD = 'homebrew-flow-pass-1';

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.8.${++lastIp}` }
	});
	return ctx.newPage();
}

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

let maker: Page;
let onlooker: Page;
let cm: Page;
let campaignId = '';
let homebrewId = '';
let warbandId = '';

test.beforeAll(async ({ browser }) => {
	const owner = await visitor(browser);
	const api = owner.context().request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);
	maker = await account(browser, owner, 'user', 'brewer', 'Brewer Ida');
	onlooker = await account(browser, owner, 'user', 'onlooker', 'Onlooker Pell');
	cm = await account(browser, owner, 'admin', 'brewmaster', 'Brewmaster Oda');
	await owner.context().close();

	const c = await cm.context().request.post('/api/v1/campaigns', {
		data: { name: 'Ember Fields', kind: 'generic', visibility: 'private', seats: 2 }
	});
	expect(c.status()).toBe(201);
	const body = await c.json();
	campaignId = body.campaign.id;
	const me = await (await maker.context().request.get('/api/v1/me')).json();
	const seated = await cm
		.context()
		.request.post(`/api/v1/campaigns/${campaignId}/seats/${body.seats[0].id}/assign`, {
			data: { userId: me.user.id }
		});
	expect(seated.status()).toBe(200);
});

test('a copy of a variant becomes my own homebrew', async () => {
	await maker.goto('/home');
	await maker.getByRole('button', { name: 'Menu', exact: true }).click();
	await maker.locator('#fl-panel').getByRole('link', { name: 'Homebrew', exact: true }).click();
	await expect(maker).toHaveURL(/\/homebrew$/);
	await expect(maker.getByText('No homebrew yet.', { exact: false })).toBeVisible();
	await maker.getByLabel('Name', { exact: true }).fill('Cinder Wardens');
	await maker.getByText('A copy of a faction or variant', { exact: true }).click();
	await maker.getByLabel('Rules it builds on').selectOption({ label: 'Core Rules 1.0.2' });
	await maker
		.getByLabel('Faction or variant', { exact: true })
		.selectOption({ label: 'Ash Wardens' });
	await maker.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(maker).toHaveURL(/\/homebrew\/[0-9a-f-]{36}$/);
	homebrewId = maker.url().split('/').at(-1)!;
	await expect(maker.getByRole('heading', { name: 'Cinder Wardens', level: 1 })).toBeVisible();
	await expect(maker.getByRole('complementary', { name: 'Checks' })).toContainText('No problems.');
});

test('a unit and a new item with a keyword; the Checks panel names a problem, then clears', async () => {
	const checks = maker.getByRole('complementary', { name: 'Checks' });
	await maker.getByRole('tab', { name: /Units/ }).click();
	await maker.getByRole('button', { name: 'Add unit' }).click();
	const unit = maker.locator('details[open][data-unit]');
	await unit.getByLabel('Name', { exact: true }).fill('Ember Scout');
	// An empty cost is a problem the checks name at once, against the unit.
	await unit.getByLabel('Cost').fill('');
	await expect(checks).toContainText('Ember Scout');
	await expect(checks).toContainText(/cost/);
	await unit.getByLabel('Cost').fill('25');
	await expect(checks).toContainText('No problems.');
	await unit.getByPlaceholder('Or a new one').fill('Smouldering');
	await unit.getByRole('button', { name: 'Add new' }).click();
	await expect(unit.getByRole('listitem').filter({ hasText: 'Smouldering' })).toBeVisible();

	await maker.getByRole('tab', { name: /Armoury/ }).click();
	const fresh = maker.locator('fieldset.new');
	await fresh.getByLabel('Name', { exact: true }).fill('Ember Pike');
	await fresh.getByLabel('Hands or type').selectOption('2-Handed');
	await fresh.getByRole('button', { name: 'Create item' }).click();
	// The copy brought no items of its own, so the new one is the only one.
	const item = maker.locator('[data-item]');
	await expect(item.getByLabel('Name', { exact: true })).toHaveValue('Ember Pike');
	await item.getByLabel('Keywords: Add a keyword').selectOption({ label: 'Steady' });
	await item.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(item.getByRole('listitem').filter({ hasText: 'Steady' })).toBeVisible();
	await expect(maker.locator('[data-line]').filter({ hasText: 'Ember Pike' })).toBeVisible();
	await expect(checks).toContainText('No problems.');

	await expect(maker.getByText('Unsaved changes')).toBeVisible();
	await maker.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(maker.getByText('Saved.', { exact: true })).toBeVisible();
	await expect(checks).toContainText('The saved version passes and is in the compendium.');
});

test('preview in the compendium', async () => {
	await maker.getByRole('link', { name: 'Preview in rules' }).click();
	await expect(maker).toHaveURL(/\/rules\/hb(:|%3A)[0-9a-f-]{36}\/warbands\/variant(:|%3A)hb-/);
	await expect(maker.getByRole('heading', { name: 'Cinder Wardens', level: 1 })).toBeVisible();
	await expect(maker.getByText('Ember Scout').first()).toBeVisible();
});

test('a warband on the homebrew', async () => {
	await maker.goto('/warbands/new');
	await maker
		.getByLabel('Rules version')
		.selectOption({ label: 'Cinder Wardens (homebrew on Core Rules 1.0.2)' });
	await expect(maker).toHaveURL(/rules=/);
	await maker.getByText('Lantern Guild', { exact: true }).click();
	await maker.getByText('Cinder Wardens', { exact: true }).click();
	await maker.getByLabel('Name', { exact: true }).fill('Ember Watch');
	await maker.getByRole('button', { name: 'Create warband' }).click();
	await expect(maker).toHaveURL(/\/warbands\/[0-9a-f-]{36}$/);
	warbandId = maker.url().split('/').at(-1)!;
	await expect(maker.getByRole('heading', { name: 'Ember Watch', level: 1 })).toBeVisible();
});

test('another player cannot see it until it is shared', async () => {
	const hidden = await onlooker.goto(`/homebrew/${homebrewId}`);
	expect(hidden?.status()).toBe(404);
	const rules = await onlooker.goto(`/rules/hb:${homebrewId}/s/core-rules`);
	expect(rules?.status()).toBe(404);
	await maker.goto(`/homebrew/${homebrewId}`);
	await maker.getByRole('tab', { name: 'Sharing' }).click();
	await maker.getByRole('button', { name: 'Share with everyone' }).click();
	await expect(maker.getByRole('button', { name: 'Make private' })).toBeVisible();
	await onlooker.goto('/homebrew');
	const card = onlooker.locator(`[data-homebrew="${homebrewId}"]`);
	await expect(card).toContainText('Cinder Wardens');
	await expect(card).toContainText('by Brewer Ida');
});

test('a seat takes the warband only once the CM allows its homebrew', async () => {
	await maker.goto(`/warbands/${warbandId}`);
	await maker.getByLabel('Campaign', { exact: true }).selectOption({ label: 'Ember Fields' });
	await maker.getByRole('button', { name: 'Assign', exact: true }).click();
	await expect(maker.getByText(/does not allow the homebrew Cinder Wardens/)).toBeVisible();

	await cm.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	await cm.getByLabel('Cinder Wardens').check();
	await cm.getByRole('button', { name: 'Save settings' }).click();
	await expect(cm.getByText('Settings saved.')).toBeVisible();

	await maker.goto(`/warbands/${warbandId}`);
	await maker.getByLabel('Campaign', { exact: true }).selectOption({ label: 'Ember Fields' });
	await maker.getByRole('button', { name: 'Assign', exact: true }).click();
	await expect(maker.getByRole('link', { name: 'Ember Fields' })).toBeVisible();
});

test('a draft with problems saves; players keep the last version that passed', async () => {
	await maker.goto(`/homebrew/${homebrewId}`);
	await maker.getByRole('tab', { name: /Units/ }).click();
	const scout = maker.locator('details[data-unit]').filter({ hasText: 'Ember Scout' });
	await scout.locator('summary').click();
	await scout.getByLabel('Cost').fill('');
	await maker.getByRole('button', { name: 'Save', exact: true }).click();
	const checks = maker.getByRole('complementary', { name: 'Checks' });
	await expect(checks).toContainText('Draft has problems; players see the version from');
	// The compendium says so too, and the warband built on it still opens.
	await maker.getByRole('link', { name: 'Preview in rules' }).click();
	await expect(maker.getByText(/Draft has problems; players see the version from/)).toBeVisible();
	await expect(maker.getByText('Ember Scout').first()).toBeVisible();
	await maker.goto(`/warbands/${warbandId}`);
	await expect(maker.getByRole('heading', { name: 'Ember Watch', level: 1 })).toBeVisible();
});
