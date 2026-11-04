/**
 * Stats with what changes them, end to end on the invented rules folders: a Warden in a Quilted Coat (an invented
 * armour with Injury Modifier -1) shows Armour -1 in green with "was 0" on the fighter panel, in play mode and on its
 * card; a Torchbearer with nothing bought shows its printed profile, uncoloured.
 */
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const LG = 'faction:lantern-guild';

let player: Page;
let warbandId = '';
let wardenId = '';
let torchId = '';

test.beforeAll(async ({ browser }) => {
	const ctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': '10.0.10.1' }
	});
	const owner = await ctx.newPage();
	const api = owner.context().request;
	const made = await api.post('/api/v1/setup', {
		data: { ...OWNER, displayName: 'Brother Anselm', textScale: 100, accent: 'blood', port: 4173 }
	});
	expect([201, 409]).toContain(made.status());
	expect((await api.post('/api/v1/auth/login', { data: OWNER })).status()).toBe(200);
	const invite = await api.post('/api/v1/invites', { data: { role: 'user' } });
	const token = String((await invite.json()).link).split('/invite/')[1];
	const pctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': '10.0.10.2' }
	});
	player = await pctx.newPage();
	const papi = pctx.request;
	expect(
		(
			await papi.post(`/api/v1/invites/token/${token}/accept`, {
				data: { username: 'statkeeper', displayName: 'Keeper Ilse', password: 'stat-flow-pass-1' }
			})
		).status()
	).toBe(201);
	const w = await papi.post('/api/v1/warbands', {
		data: { name: 'The Quilted Few', factionId: LG }
	});
	warbandId = (await w.json()).id;
	const a = await papi.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/warden', kit: ['line:lantern-guild/quilted-coat'] }
	});
	expect(a.status()).toBe(201);
	const b = await papi.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/torchbearer' }
	});
	const fighters = (await b.json()).fighters as { id: string; unitId: string }[];
	wardenId = fighters.find((f) => f.unitId.endsWith('/warden'))!.id;
	torchId = fighters.find((f) => f.unitId.endsWith('/torchbearer'))!.id;
});

const armourBox = (scope: ReturnType<Page['locator']>) =>
	scope.locator('.stat').filter({ hasText: 'Armour' });

test('bought armour shows green with what it was, on the panel, in play mode and on the card', async () => {
	await player.goto(`/warbands/${warbandId}?sel=${wardenId}`);
	const panel = player.locator(`[data-panel="fighter"][data-fighter="${wardenId}"]`);
	const box = armourBox(panel);
	await expect(box).toHaveAttribute('data-tone', 'better');
	await expect(box).toContainText('-1');
	await expect(box).toContainText('was 0');
	await expect(box).toHaveAttribute('title', 'Printed 0 · Quilted Coat -1');

	await player.getByRole('link', { name: 'Card' }).click();
	await expect(player.getByRole('dialog').getByText('Armour -1 (was 0)')).toBeAttached();

	await player.goto(`/warbands/${warbandId}/play`);
	await expect(armourBox(player.locator(`[data-play="${wardenId}"]`))).toHaveAttribute(
		'data-tone',
		'better'
	);
});

test('a fighter with nothing changing its stats shows them as printed, uncoloured', async () => {
	await player.goto(`/warbands/${warbandId}?sel=${torchId}`);
	const panel = player.locator(`[data-panel="fighter"][data-fighter="${torchId}"]`);
	await expect(panel.locator('.stat').first()).toBeVisible();
	await expect(panel.locator('.stat[data-tone]')).toHaveCount(0);
	await expect(panel).not.toContainText('was ');
});
