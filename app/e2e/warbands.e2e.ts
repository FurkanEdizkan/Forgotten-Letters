/**
 * Steps 3-4 warband flows end to end on the invented rules folders (the Lantern Guild: a Warden at 60, the one
 * allowed, with a Veteran upgrade for 1 Glory; Torchbearers at 30): the wizard; fighters, an upgrade taken with the
 * recruit, and kit up to the limit, with refusals and their reasons in the dialog; the Trench Companion text export and importing it back; a fighter picture (a wrong file refused); putting
 * the warband in a campaign seat, which the CM sees read-only; and the CM allowing warbands beyond their limits, so an
 * over-limit recruit goes through as a warning.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PASSWORD = 'warband-flow-pass-1';
// A 1×1 PNG, so the browser shows a real picture.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);
const TEXT = [
	'## Lamp Wardens ##',
	'Faction: Lantern Guild',
	'Rating: 100 Ducats | 1 Glory',
	'Patron: The Keeper',
	'',
	'## Elites ##',
	'',
	'Warden - Old Marl',
	'• Cost: 60 Ducats | 1 Glory',
	'• Upgrades & Choices: Veteran',
	'• Battlekit: Signal Lantern',
	'',
	'## Troops ##',
	'',
	'Torchbearer',
	'• Cost: 40 Ducats | 0 Glory',
	'• Battlekit: Hook Rifle',
	'',
	'## Stash ##',
	'Stashed Ducats: 0',
	'Unspent Glory: 0',
	''
].join('\n');

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.6.${++lastIp}` }
	});
	return ctx.newPage();
}

async function account(browser: Browser, owner: Page, role: 'admin' | 'user', username: string) {
	const made = await owner.context().request.post('/api/v1/invites', { data: { role } });
	expect(made.status()).toBe(201);
	const token = String((await made.json()).link).split('/invite/')[1];
	const page = await visitor(browser);
	const accepted = await page.context().request.post(`/api/v1/invites/token/${token}/accept`, {
		data: {
			username,
			displayName: username === 'marshal' ? 'Marshal Ute' : 'Keeper Ansel',
			password: PASSWORD
		}
	});
	expect(accepted.status()).toBe(201);
	return page;
}

let cm: Page;
let player: Page;
let campaignId = '';
let warbandId = '';

test.beforeAll(async ({ browser }) => {
	const owner = await visitor(browser);
	const api = owner.context().request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);
	cm = await account(browser, owner, 'admin', 'marshal');
	player = await account(browser, owner, 'user', 'lampkeeper');
	await owner.context().close();

	// A generic campaign (core-1.0.2, no expansion) with the player in its first seat.
	const c = await cm.context().request.post('/api/v1/campaigns', {
		data: { name: 'Marsh Roads', kind: 'generic', visibility: 'private', seats: 2 }
	});
	expect(c.status()).toBe(201);
	const body = await c.json();
	campaignId = body.campaign.id;
	const me = await (await player.context().request.get('/api/v1/me')).json();
	const seated = await cm
		.context()
		.request.post(`/api/v1/campaigns/${campaignId}/seats/${body.seats[0].id}/assign`, {
			data: { userId: me.user.id }
		});
	expect(seated.status()).toBe(200);
});

test('the wizard: faction, Patron, name and limit make a warband', async () => {
	await player.goto('/home');
	await player.getByRole('button', { name: 'Menu', exact: true }).click();
	await player.locator('#fl-panel').getByRole('link', { name: 'Warbands', exact: true }).click();
	await expect(player).toHaveURL(/\/warbands$/);
	await player.getByRole('link', { name: 'New warband' }).first().click();
	await expect(player.getByRole('heading', { name: 'New warband', level: 1 })).toBeVisible();
	await player.getByText('Lantern Guild', { exact: true }).click();
	await player.getByText('The Keeper', { exact: true }).click();
	await player.getByLabel('Name', { exact: true }).fill('Lamp Wardens');
	await expect(player.getByLabel('Ducat limit')).toHaveValue('700');
	await player.getByLabel('Ducat limit').fill('100');
	await player.getByRole('button', { name: 'Create warband' }).click();
	await expect(player).toHaveURL(/\/warbands\/[0-9a-f-]{36}$/);
	warbandId = player.url().split('/').at(-1)!;
	await expect(player.getByRole('heading', { name: 'Lamp Wardens', level: 1 })).toBeVisible();
	await expect(player.getByText('0 Ducats | 0 Glory')).toBeVisible();
	await expect(player.getByText('The warband must include its Leader (Warden).')).toBeVisible();
});

test('fighters and kit up to the limit; a recruit that is not allowed says why in the dialog', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await player.getByRole('link', { name: 'Add fighter' }).click();
	const dialog = player.getByRole('dialog', { name: 'Add fighter' });
	await expect(dialog).toBeVisible();
	const warden = dialog.locator('[data-unit="unit:lantern-guild/warden"]');
	// The Veteran upgrade costs Glory the warband does not have: refused with its reason, in the dialog.
	await warden.getByLabel(/Veteran/).check();
	await warden.getByRole('button', { name: 'Recruit' }).click();
	await expect(dialog.getByText(/Costs 1 Glory; 0 in the strongbox/)).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).click();
	await player.getByRole('button', { name: 'Warband details' }).click();
	await player.getByLabel('Unspent Glory').fill('1');
	await player.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(player.getByText('Saved.')).toBeVisible();
	await player.getByRole('link', { name: 'Add fighter' }).click();
	await warden.getByLabel(/Veteran/).check();
	await warden.getByRole('button', { name: 'Recruit' }).click();
	await expect(
		dialog.locator('[data-unit="unit:lantern-guild/warden"]').getByText('Limit reached (1/1).')
	).toBeVisible();
	const torch = dialog.locator('[data-unit="unit:lantern-guild/torchbearer"]');
	await torch.getByRole('button', { name: 'Recruit' }).click();
	await expect(torch.getByText(/Costs 30 Ducats; 10 in the strongbox/)).toBeVisible();
	await expect(torch.getByRole('button', { name: 'Recruit' })).toBeDisabled();
	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();

	// The API refuses the same recruit with the engine's reasons.
	const refused = await player.context().request.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/torchbearer' }
	});
	expect(refused.status()).toBe(409);
	expect((await refused.json()).error.message).toMatch(/Over the ducat limit \(120 of 100\)/);

	const card = player.locator('[data-group="troop"] article').first();
	await card.getByRole('link', { name: 'Equip' }).click();
	const equip = player.getByRole('dialog', { name: 'Equip Torchbearer' });
	await equip
		.locator('[data-line="line:lantern-guild/hook-rifle"]')
		.getByRole('button', { name: 'Buy' })
		.click();
	await expect(equip.getByText(/Hook Rifle/).first()).toBeVisible();
	await expect(
		equip.locator('[data-line="line:lantern-guild/pavise"]').getByText(/Warden/)
	).toBeVisible();
	await equip.getByRole('button', { name: 'Close' }).click();
	await expect(player.getByText('100 Ducats | 1 Glory').first()).toBeVisible();
	await expect(player.getByText('No problems')).toBeVisible();

	// Name the Warden, so the export matches the Trench Companion layout below.
	const elite = player.locator('[data-group="elite"] article').first();
	await elite.getByRole('button', { name: 'Edit' }).click();
	await elite.getByLabel('Name (optional)').fill('Old Marl');
	await elite.getByRole('button', { name: 'Save' }).click();
	await expect(elite.getByRole('heading', { name: 'Old Marl' })).toBeVisible();
});

test('export: the Trench Companion layout; importing it back', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await player.getByRole('link', { name: 'Export' }).click();
	const dialog = player.getByRole('dialog', { name: 'Export' });
	await expect(dialog.locator('[data-export]')).toHaveText(TEXT, { useInnerText: true });
	const file = await player
		.context()
		.request.get(`/api/v1/warbands/${warbandId}/export?format=text`);
	expect(await file.text()).toBe(TEXT);
	await dialog.getByRole('button', { name: 'Close' }).click();

	await player.goto('/warbands');
	await player.getByLabel('Text').fill(TEXT);
	await player.getByRole('button', { name: 'Import' }).click();
	await expect(player.getByText('Imported Lamp Wardens.')).toBeVisible();
	await expect(player.getByText('Not matched (left out):')).toHaveCount(0);
	await expect(player.locator('[data-warband]')).toHaveCount(2);

	// Text that names no faction of these rules is refused with the reason.
	await player.getByLabel('Text').fill('## Nobody ##\nFaction: Unknown Order');
	await player.getByRole('button', { name: 'Import' }).click();
	await expect(player.getByText(/No faction or variant named "Unknown Order"/)).toBeVisible();
});

test('a fighter picture: a PNG is shown, another file is refused', async () => {
	await player.goto(`/warbands/${warbandId}`);
	const warden = player.locator('[data-group="elite"] article').first();
	await warden.locator('input[type=file]').setInputFiles({
		name: 'marl.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await expect(warden.getByRole('img', { name: 'Picture of Old Marl' })).toBeVisible();
	const torch = player.locator('[data-group="troop"] article').first();
	await torch.locator('input[type=file]').setInputFiles({
		name: 'notes.png',
		mimeType: 'image/png',
		buffer: Buffer.from('not a picture at all')
	});
	await expect(torch.getByText('That file is not a PNG, JPEG or WebP image.')).toBeVisible();
});

test('assigned to a seat, the CM sees it read-only', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await player.getByLabel('Campaign', { exact: true }).selectOption({ label: 'Marsh Roads' });
	await player.getByRole('button', { name: 'Assign', exact: true }).click();
	await expect(player.getByRole('link', { name: 'Marsh Roads' })).toBeVisible();

	// Another campaign's player cannot reach it; the CM sees every seat's warband.
	await cm.goto(`/campaigns/${campaignId}`);
	const card = cm.locator(`[data-warband="${warbandId}"]`);
	await expect(card).toContainText('Lamp Wardens');
	await expect(card).toContainText('100 Ducats | 1 Glory');
	await card.getByRole('link', { name: 'Lamp Wardens' }).click();
	await expect(cm.getByText(/Keeper Ansel’s warband/)).toBeVisible();
	await expect(cm.getByRole('link', { name: 'Add fighter' })).toHaveCount(0);
});

test('the CM allows beyond limits: an over-limit recruit becomes a warning', async () => {
	await cm.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	await cm.getByText('Allow warbands beyond their limits').click();
	await cm.getByRole('button', { name: 'Save settings' }).click();
	await expect(cm.getByText('Settings saved.')).toBeVisible();

	await player.goto(`/warbands/${warbandId}?add`);
	const torch = player
		.getByRole('dialog', { name: 'Add fighter' })
		.locator('[data-unit="unit:lantern-guild/torchbearer"]');
	await expect(torch.getByRole('button', { name: 'Recruit' })).toBeEnabled();
	await torch.getByRole('button', { name: 'Recruit' }).click();
	await player
		.getByRole('dialog', { name: 'Add fighter' })
		.getByRole('button', { name: 'Close' })
		.click();
	await expect(
		player.getByText('The fighters are worth 130 Ducats, over the limit of 100.')
	).toBeVisible();
	await expect(player.getByText(/problems are warnings/)).toBeVisible();

	// While the warband sits there, the campaign cannot move to another rules version.
	await cm.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	await cm.getByLabel('Rules version').selectOption('core-1.0.1');
	await cm.getByRole('button', { name: 'Save settings' }).click();
	await expect(cm.getByText(/Lamp Wardens is built for other rules/)).toBeVisible();
});
