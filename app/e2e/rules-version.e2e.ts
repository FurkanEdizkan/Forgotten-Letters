/**
 * A warband's rules version, end to end on the invented rules folders (Mire Preview is a `preview` expansion on Mire
 * Front, on core 1.0.2, that prices the Warden at 65): the list card and the builder show "1.0.2"; its owner switches
 * it to "1.0.2 (Preview)" in the Warband panel and both show it with the preview tag; creating a warband offers the
 * Preview. Error path: a warband in a campaign seat shows "Set by <campaign>" and no switch.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PASSWORD = 'rules-flow-pass-1';
const LG = 'faction:lantern-guild';

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.13.${++lastIp}` }
	});
	return ctx.newPage();
}

let owner: Page;
let player: Page;
let warbandId = '';

test.beforeAll(async ({ browser }) => {
	owner = await visitor(browser);
	const api = owner.context().request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);
	const invite = await api.post('/api/v1/invites', { data: { role: 'user' } });
	const token = String((await invite.json()).link).split('/invite/')[1];
	player = await visitor(browser);
	const accepted = await player.context().request.post(`/api/v1/invites/token/${token}/accept`, {
		data: { username: 'rulekeeper', displayName: 'Keeper Wren', password: PASSWORD }
	});
	expect(accepted.status()).toBe(201);
	const w = await player.context().request.post('/api/v1/warbands', {
		data: { name: 'The Versioned', factionId: LG, rules: 'core-1.0.2' }
	});
	expect(w.status()).toBe(201);
	warbandId = (await w.json()).id;
	const f = await player.context().request.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/warden' }
	});
	expect(f.status()).toBe(201);
});

const tag = (scope: ReturnType<Page['locator']>) => scope.locator('[data-rules]').first();

test('the owner switches a warband to the Preview; its card and builder say so', async () => {
	await player.goto('/warbands');
	const card = player.locator(`[data-warband="${warbandId}"]`);
	await expect(tag(card)).toHaveAttribute('data-rules', '1.0.2');

	await player.goto(`/warbands/${warbandId}`);
	await expect(tag(player.locator('header.head'))).toHaveAttribute('data-rules', '1.0.2');
	const form = player.locator('form[data-form="rules"]');
	await form.getByLabel('Change rules').selectOption({ label: 'Core Rules 1.0.2 (Preview)' });
	await form.getByRole('button', { name: 'Switch' }).click();
	await form.getByRole('button', { name: 'Yes, switch' }).click();

	const head = tag(player.locator('header.head'));
	await expect(head).toHaveAttribute('data-rules', '1.0.2 (Preview)');
	await expect(head).toHaveClass(/preview/);
	await expect(head).toHaveAttribute('title', 'Preview: not an official release');
	// The preview prices the Warden at 65.
	await expect(player.locator('[data-panel="warband"]')).toContainText('65');

	await player.goto('/warbands');
	await expect(tag(card)).toHaveAttribute('data-rules', '1.0.2 (Preview)');
});

test('creating a warband offers the Preview', async () => {
	await player.goto('/warbands/new');
	await expect(
		player.getByLabel('Rules').locator('option', { hasText: 'Core Rules 1.0.2 (Preview)' })
	).toHaveCount(1);
});

test('in a campaign seat the rules are the campaign’s: no switch', async () => {
	const api = owner.context().request;
	const c = await api.post('/api/v1/campaigns', {
		data: { name: 'Bog Roads', kind: 'generic', visibility: 'private', seats: 2 }
	});
	expect(c.status()).toBe(201);
	const body = await c.json();
	const me = await (await player.context().request.get('/api/v1/me')).json();
	const seated = await api.post(
		`/api/v1/campaigns/${body.campaign.id}/seats/${body.seats[0].id}/assign`,
		{ data: { userId: me.user.id } }
	);
	expect(seated.status()).toBe(200);
	// A warband on the campaign's rules (core-1.0.2) sits in the seat.
	const w = await player.context().request.post('/api/v1/warbands', {
		data: { name: 'The Seated', factionId: LG, rules: 'core-1.0.2' }
	});
	const sid = (await w.json()).id;
	const put = await player
		.context()
		.request.put(`/api/v1/campaigns/${body.campaign.id}/seats/mine/warband`, {
			data: { warbandId: sid }
		});
	expect(put.status()).toBe(200);

	await player.goto(`/warbands/${sid}`);
	const panel = player.locator('[data-panel="warband"]');
	await expect(panel.locator('[data-rules-locked]')).toContainText('Set by Bog Roads');
	await expect(panel.locator('form[data-form="rules"]')).toHaveCount(0);
});
