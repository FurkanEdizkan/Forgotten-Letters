/**
 * Warband flows end to end on the invented rules folders (the Lantern Guild: a Warden at 60, the one allowed, with a
 * Veteran upgrade for 1 Glory; Torchbearers at 30; an Ash Wardens variant), on the two-column builder (step 4
 * revision 2): the grouped new-warband list; fighters added per group, an upgrade taken with the recruit, and kit up
 * to the limit, with refusals and their reasons in the dialog; the Patron on the Campaign panel; the Trench
 * Companion text export and importing it back; a fighter picture (a wrong file refused); kit moved to and from the
 * Arsenal, refunded before the first game and sold for half after it; Experience, an injury and the unfit status
 * (its kit goes to the Arsenal); play mode and its print layout; putting the warband in a campaign seat, which the CM
 * sees read-only (and, once it has played, only the CM changes the Patron); and the CM allowing warbands beyond their
 * limits, so an over-limit recruit goes through as a warning.
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

const RIFLE = 'line:lantern-guild/hook-rifle';
const panel = () => player.locator('[data-panel]');
const row = (group: string, n = 0) => {
	const r = player.locator(`[data-group="${group}"] [data-fighter]`).nth(n);
	return {
		/** Open the fighter's panel and wait until it shows that fighter. */
		click: async () => {
			const id = await r.getAttribute('data-fighter');
			await r.locator('a.open').click();
			await expect(player.locator(`[data-panel="fighter"][data-fighter="${id}"]`)).toBeVisible();
		}
	};
};
/** Open a piece of kit's ⋮ menu on the fighter panel or in the Arsenal. */
const kitMenu = (where: string) => {
	const host = player.locator(where).first();
	return { open: () => host.locator('summary').click(), host };
};

test('the new-warband list: a faction or a variant in one click, starting banks prefilled', async () => {
	await player.goto('/home');
	await player.getByRole('button', { name: 'Menu', exact: true }).click();
	await player.locator('#fl-panel').getByRole('link', { name: 'Warbands', exact: true }).click();
	await expect(player).toHaveURL(/\/warbands$/);
	await player.getByRole('link', { name: 'New warband' }).first().click();
	await expect(player.getByRole('heading', { name: 'New warband', level: 1 })).toBeVisible();
	// Nothing picked: nothing to fill in yet.
	await expect(player.getByRole('button', { name: 'Create warband' })).toHaveCount(0);
	await player.getByText('Ash Wardens', { exact: true }).click();
	await expect(player.getByLabel('Starting Glory')).toHaveValue('0');
	await player.locator('[data-faction="faction:lantern-guild"] label').first().click();
	await player.getByLabel('Name', { exact: true }).fill('Lamp Wardens');
	await expect(player.getByLabel('Starting Ducats (the ducat limit)')).toHaveValue('700');
	await player.getByLabel('Starting Ducats (the ducat limit)').fill('100');
	await player.getByRole('button', { name: 'Create warband' }).click();
	await expect(player).toHaveURL(/\/warbands\/[0-9a-f-]{36}$/);
	warbandId = player.url().split('/').at(-1)!;
	await expect(player.getByRole('heading', { name: 'Lamp Wardens', level: 1 })).toBeVisible();
	await expect(player.locator('[data-card="warband"]')).toContainText('0 Ducats of 100 Ducats');
	await expect(player.getByText('The warband must include its Leader (Warden).')).toBeVisible();

	// The Patron is chosen afterwards, on the Campaign panel.
	await player.locator('[data-card="campaign"]').click();
	await panel().getByLabel('Patron').selectOption({ label: 'The Keeper' });
	await panel().getByRole('button', { name: 'Save', exact: true }).click();
	await expect(panel().getByText('Saved.')).toBeVisible();
});

test('fighters per group and kit up to the limit; a recruit that is not allowed says why in the dialog', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await player.getByRole('link', { name: 'Add to Elites' }).click();
	const dialog = player.getByRole('dialog', { name: 'Add to Elites' });
	await expect(dialog).toBeVisible();
	const warden = dialog.locator('[data-unit="unit:lantern-guild/warden"]');
	await expect(warden).toContainText('0 / 1');
	await expect(dialog.locator('[data-unit="unit:lantern-guild/torchbearer"]')).toHaveCount(0);
	// The Veteran upgrade costs Glory the warband does not have: refused with its reason, in the dialog.
	await warden.getByLabel(/Veteran/).check();
	await warden.getByRole('button', { name: 'Recruit' }).click();
	await expect(dialog.getByText(/Costs 1 Glory; 0 in the strongbox/)).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).click();
	await player.locator('[data-card="arsenal"]').click();
	await panel().getByRole('button', { name: 'Edit' }).click();
	await panel().getByLabel('Unspent Glory').fill('1');
	await panel().getByRole('button', { name: 'Save', exact: true }).click();
	await expect(player.locator('[data-card="arsenal"]')).toContainText('100 Ducats · 1 Glory');
	await player.getByRole('link', { name: 'Add to Elites' }).click();
	await warden.getByLabel(/Veteran/).check();
	await warden.getByRole('button', { name: 'Recruit' }).click();
	await expect(warden.getByText('Limit reached (1/1).')).toBeVisible();
	await dialog.getByRole('button', { name: 'Close' }).click();
	await player.getByRole('link', { name: 'Add to Troops' }).click();
	const troops = player.getByRole('dialog', { name: 'Add to Troops' });
	const torch = troops.locator('[data-unit="unit:lantern-guild/torchbearer"]');
	await torch.getByRole('button', { name: 'Recruit' }).click();
	await expect(torch.getByText(/Costs 30 Ducats; 10 in the strongbox/)).toBeVisible();
	await expect(torch.getByRole('button', { name: 'Recruit' })).toBeDisabled();
	await troops.getByRole('button', { name: 'Close' }).click();
	await expect(troops).toBeHidden();

	// The API refuses the same recruit with the engine's reasons.
	const refused = await player.context().request.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/torchbearer' }
	});
	expect(refused.status()).toBe(409);
	expect((await refused.json()).error.message).toMatch(/Over the ducat limit \(120 of 100\)/);

	await row('troop').click();
	await panel().getByRole('link', { name: 'Buy Ranged Weapons' }).click();
	const equip = player.getByRole('dialog', { name: 'Equip Torchbearer' });
	await equip.locator(`[data-line="${RIFLE}"]`).getByRole('button', { name: 'Buy' }).click();
	await equip.getByRole('button', { name: 'All' }).click();
	await expect(
		equip.locator('[data-line="line:lantern-guild/pavise"]').getByText(/Warden/)
	).toBeVisible();
	await equip.getByRole('button', { name: 'Close' }).click();
	await expect(panel().locator(`[data-kit="${RIFLE}"]`)).toContainText('10 Ducats');
	await expect(player.locator('[data-card="warband"]')).toContainText('100 Ducats · 1 Glory');
	await expect(player.locator('[data-card="warband"]')).toContainText('No problems');

	// Name the Warden, so the export matches the Trench Companion layout below.
	await row('elite').click();
	await panel().getByRole('button', { name: 'Rename' }).click();
	await panel().getByLabel('Name (optional)').fill('Old Marl');
	await panel().getByRole('button', { name: 'Save' }).click();
	await expect(panel().getByRole('heading', { name: /Old Marl/ })).toBeVisible();
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
	await row('elite').click();
	await panel().locator('input[type=file]').setInputFiles({
		name: 'marl.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await expect(panel().getByRole('img', { name: 'Picture of Old Marl' })).toBeVisible();
	await row('troop').click();
	await panel()
		.locator('input[type=file]')
		.setInputFiles({
			name: 'notes.png',
			mimeType: 'image/png',
			buffer: Buffer.from('not a picture at all')
		});
	await expect(panel().getByText('That file is not a PNG, JPEG or WebP image.')).toBeVisible();
});

test('the Arsenal: kit moves for free; a refund before the first game, half back after it', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await row('troop').click();
	let menu = kitMenu(`[data-kit="${RIFLE}"]`);
	await menu.open();
	await menu.host.getByLabel('Move to…').selectOption({ label: 'Arsenal' });
	await menu.host.getByRole('button', { name: 'Move' }).click();
	await expect(player.locator('[data-card="arsenal"]')).toContainText('Hook Rifle');
	await expect(player.locator('[data-card="arsenal"]')).toContainText('Strongbox: 0 Ducats');

	await player.locator('[data-card="arsenal"]').click();
	menu = kitMenu(`[data-stash="${RIFLE}"]`);
	await menu.open();
	await menu.host.getByLabel('Move to…').selectOption({ label: 'Torchbearer' });
	await menu.host.getByRole('button', { name: 'Move' }).click();
	await expect(player.locator('[data-group="troop"]')).toContainText('Hook Rifle');

	// Before the first game a refund gives everything back; then the warband has played.
	await row('troop').click();
	menu = kitMenu(`[data-kit="${RIFLE}"]`);
	await menu.open();
	await menu.host.getByRole('button', { name: /^Refund/ }).click();
	await expect(player.locator('[data-card="arsenal"]')).toContainText('Strongbox: 10 Ducats');
	await panel().getByRole('link', { name: 'Buy Ranged Weapons' }).click();
	const equip = player.getByRole('dialog', { name: 'Equip Torchbearer' });
	await equip.locator(`[data-line="${RIFLE}"]`).getByRole('button', { name: 'Buy' }).click();
	await equip.getByRole('button', { name: 'Close' }).click();
	await player.locator('[data-card="campaign"]').click();
	await panel().getByLabel('Games played').fill('1');
	await panel().getByRole('button', { name: 'Save', exact: true }).click();
	await expect(
		panel().getByText('The warband has played: kit sells for half its price.')
	).toBeVisible();

	await row('troop').click();
	menu = kitMenu(`[data-kit="${RIFLE}"]`);
	await menu.open();
	await expect(menu.host.getByRole('button', { name: /^Refund/ })).toBeDisabled();
	// The API refuses the refund too, with the reason.
	const fid = await player
		.locator('[data-group="troop"] [data-fighter]')
		.first()
		.getAttribute('data-fighter');
	const refund = await player
		.context()
		.request.delete(`/api/v1/warbands/${warbandId}/fighters/${fid}/kit?line=${RIFLE}&mode=refund`);
	expect(refund.status()).toBe(409);
	expect((await refund.json()).error.message).toMatch(/sell the kit for half/);
	await menu.host.getByRole('button', { name: /^Sell \(half\)/ }).click();
	await expect(player.locator('[data-card="arsenal"]')).toContainText('Strongbox: 5 Ducats');
});

test('campaign data: Experience, an injury, and unfit for duty (its kit goes to the Arsenal)', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await row('elite').click();
	await expect(panel().getByRole('button', { name: 'One less Experience' })).toBeDisabled();
	await panel().getByRole('button', { name: 'One more Experience' }).click();
	await expect(panel().getByText('None due.')).toBeVisible();
	await panel().getByRole('button', { name: 'One more Experience' }).click();
	await expect(panel().getByText('1 advancement due.')).toBeVisible();
	await panel()
		.getByLabel('Add from the tables: Injuries')
		.selectOption({ label: '7-12 · Scarred' });
	await panel().getByRole('button', { name: 'Add', exact: true }).last().click();
	await expect(panel().locator('[data-campaign]')).toContainText('Scarred');
	await panel()
		.getByLabel('Add from the tables: Advancements')
		.selectOption({ label: '2-6 · Steady Aim' });
	await panel().getByRole('button', { name: 'Add', exact: true }).first().click();
	await expect(panel().locator('[data-campaign]')).toContainText('Steady Aim');
	await expect(panel().getByText('None due.')).toBeVisible();

	await player.goto(`/warbands/${warbandId}`);
	await row('troop').click();
	await panel().getByRole('link', { name: 'Buy Equipment' }).click();
	const equip = player.getByRole('dialog', { name: 'Equip Torchbearer' });
	await equip
		.locator('[data-line="line:lantern-guild/lantern"]')
		.getByRole('button', { name: 'Buy' })
		.click();
	await equip.getByRole('button', { name: 'Close' }).click();
	await panel().getByLabel('Status').selectOption({ label: 'Unfit for duty' });
	await panel().getByRole('button', { name: 'Change' }).click();
	await expect(player.locator('[data-group="dead"]')).toContainText('Unfit for duty');
	await expect(player.locator('[data-card="arsenal"]')).toContainText('Signal Lantern');
	await expect(player.locator('[data-group="troop"]')).toContainText('None yet');
});

test('play mode: read-only cards with profiles; the print layout leaves the app bars out', async () => {
	await player.goto(`/warbands/${warbandId}`);
	await player.getByRole('link', { name: 'Play mode' }).click();
	await expect(player).toHaveURL(/\/play$/);
	const card = player.locator('[data-play]').first();
	await expect(card).toContainText('Old Marl');
	await expect(card).toContainText('Move');
	await expect(player.locator('[data-play]')).toHaveCount(1); // the unfit Torchbearer is off the roster
	await expect(player.getByRole('button', { name: 'Recruit' })).toHaveCount(0);
	await player.emulateMedia({ media: 'print' });
	await expect(player.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
	await expect(player.getByRole('button', { name: 'Print' })).toBeHidden();
	await player.emulateMedia({ media: 'screen' });
});

test('assigned to a seat, the CM sees it read-only; once played, only the CM changes the Patron', async () => {
	await player.goto(`/warbands/${warbandId}?sel=campaign`);
	await panel().getByLabel('Campaign', { exact: true }).selectOption({ label: 'Marsh Roads' });
	await panel().getByRole('button', { name: 'Assign', exact: true }).click();
	await expect(panel().getByRole('link', { name: 'Marsh Roads' })).toBeVisible();
	await expect(
		panel().getByText('After the first game only the campaign master changes it.')
	).toBeVisible();
	await expect(panel().getByLabel('Patron')).toHaveCount(0);

	// The CM sees every seat's warband, read-only, and may change its Patron.
	await cm.goto(`/campaigns/${campaignId}`);
	const card = cm.locator(`[data-warband="${warbandId}"]`);
	await expect(card).toContainText('Lamp Wardens');
	await card.getByRole('link', { name: 'Lamp Wardens' }).click();
	await expect(cm.getByText(/Keeper Ansel’s warband/)).toBeVisible();
	await expect(cm.getByRole('link', { name: 'Add to Elites' })).toHaveCount(0);
	await cm.locator('[data-card="campaign"]').click();
	await cm.locator('[data-panel]').getByLabel('Patron').selectOption({ label: 'No Patron' });
	await cm.locator('[data-panel]').getByRole('button', { name: 'Save', exact: true }).click();
	await expect(cm.locator('[data-panel]').getByLabel('Patron')).toHaveValue('');
});

test('the CM allows beyond limits: an over-limit recruit becomes a warning', async () => {
	await cm.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	await cm.getByText('Allow warbands beyond their limits').click();
	await cm.getByRole('button', { name: 'Save settings' }).click();
	await expect(cm.getByText('Settings saved.')).toBeVisible();

	for (let i = 0; i < 2; i++) {
		await player.goto(`/warbands/${warbandId}?add=troop`);
		const torch = player
			.getByRole('dialog', { name: 'Add to Troops' })
			.locator('[data-unit="unit:lantern-guild/torchbearer"]');
		await expect(torch.getByRole('button', { name: 'Recruit' })).toBeEnabled();
		await torch.getByRole('button', { name: 'Recruit' }).click();
		await expect(player.locator('[data-group="troop"] [data-fighter]')).toHaveCount(i + 1);
	}
	await player.goto(`/warbands/${warbandId}`);
	await expect(player.getByText(/over the limit of 100/)).toBeVisible();
	await expect(player.getByText(/problems are warnings/).first()).toBeVisible();

	// While the warband sits there, the campaign cannot move to another rules version.
	await cm.goto(`/campaigns/${campaignId}/manage?tab=settings`);
	await cm.getByLabel('Rules version').selectOption('core-1.0.1');
	await cm.getByRole('button', { name: 'Save settings' }).click();
	await expect(cm.getByText(/Lamp Wardens is built for other rules/)).toBeVisible();
});
