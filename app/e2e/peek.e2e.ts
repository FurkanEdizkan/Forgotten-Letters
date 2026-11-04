/**
 * Rules cards in the builder, end to end on the invented rules folders: clicking the Hook Rifle opens its card over
 * the builder (the page stays), with its range, keyword and text and a "Read in the docs" link to a new tab; Esc
 * closes it; resting on a keyword chip shows the keyword; inside the Equip dialog the card shows above the dialog.
 * Error path: when the rules cannot be loaded the card says so and still offers the docs.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const LG = 'faction:lantern-guild';

let player: Page;
let warbandId = '';
let wardenId = '';

test.beforeAll(async ({ browser }) => {
	const octx = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.0.11.1' } });
	const api = octx.request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);
	const invite = await api.post('/api/v1/invites', { data: { role: 'user' } });
	const token = String((await invite.json()).link).split('/invite/')[1];
	const pctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': '10.0.11.2' }
	});
	player = await pctx.newPage();
	const papi = pctx.request;
	const accepted = await papi.post(`/api/v1/invites/token/${token}/accept`, {
		data: { username: 'peekkeeper', displayName: 'Keeper Oda', password: 'peek-flow-pass-1' }
	});
	expect(accepted.status()).toBe(201);
	const w = await papi.post('/api/v1/warbands', { data: { name: 'The Lookers', factionId: LG } });
	warbandId = (await w.json()).id;
	const f = await papi.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/warden', kit: ['line:lantern-guild/hook-rifle'] }
	});
	expect(f.status()).toBe(201);
	wardenId = (await f.json()).fighters[0].id;
});

const card = () => player.locator('[data-peek]');
const panel = () => player.locator(`[data-panel="fighter"][data-fighter="${wardenId}"]`);

test('a rules card opens over the builder, links to the docs in a new tab, and closes with Esc', async () => {
	await player.goto(`/warbands/${warbandId}?sel=${wardenId}`);
	const url = player.url();
	await panel().getByRole('link', { name: 'Hook Rifle' }).click();
	await expect(card()).toBeVisible();
	await expect(card()).toHaveAttribute('data-peek', 'item:hook-rifle');
	await expect(card()).toContainText('Hook Rifle');
	await expect(card()).toContainText('24"');
	await expect(card()).toContainText('Volley 2');
	await expect(card()).toContainText('grappling hook');
	expect(player.url()).toBe(url);
	const docs = card().getByRole('link', { name: 'Read in the docs ↗' });
	await expect(docs).toHaveAttribute('target', '_blank');
	await expect(docs).toHaveAttribute('href', /\/rules\/core-1\.0\.2\/e\/item%3Ahook-rifle$/);

	await player.keyboard.press('Escape');
	await expect(card()).toBeHidden();

	// Resting on a keyword chip shows the keyword, and leaving it hides the card.
	await panel().getByRole('link', { name: 'Steady' }).hover();
	await expect(card()).toContainText('ignores the first shove');
	await player.mouse.move(5, 5);
	await expect(card()).toBeHidden();
});

test('inside the Equip dialog the card shows above the dialog', async () => {
	await player.goto(`/warbands/${warbandId}?sel=${wardenId}`);
	await panel().getByRole('link', { name: 'Buy Ranged Weapons' }).click();
	const dialog = player.locator('dialog[open]');
	await dialog.getByRole('link', { name: 'Hook Rifle' }).first().click();
	await expect(card()).toBeVisible();
	// The topmost element at the card's centre is the card, not the dialog under it.
	const onTop = await card().evaluate((el) => {
		const r = el.getBoundingClientRect();
		return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
	});
	expect(onTop).toBe(true);
	await card().getByRole('button', { name: 'Close' }).click();
	await expect(card()).toBeHidden();
	await expect(player.locator('dialog[open]')).toBeVisible();

	// Esc closes the card first, then the dialog.
	await dialog.getByRole('link', { name: 'Hook Rifle' }).first().click();
	await expect(card()).toBeVisible();
	await player.keyboard.press('Escape');
	await expect(card()).toBeHidden();
	await expect(player.locator('dialog[open]')).toBeVisible();
});

test('when the rules cannot be loaded the card says so and still offers the docs', async () => {
	await player.route('**/api/v1/rules/node**', (r) => r.fulfill({ status: 503, body: '{}' }));
	await player.goto(`/warbands/${warbandId}?sel=${wardenId}`);
	await panel().getByRole('link', { name: 'Warden', exact: true }).click();
	await expect(card().getByRole('alert')).toContainText('could not be loaded');
	await expect(card().getByRole('link', { name: 'Read in the docs ↗' })).toBeVisible();
	await player.unroute('**/api/v1/rules/node**');
});
