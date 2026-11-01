/**
 * Fighter cards end to end on the invented rules folders (step 4 revision 3): the Owner uploads a frame for the
 * Lantern Guild on Owner → Card frames (a wrong-size file is refused with its size), downloads the template; a
 * player opens a fighter's card from the fighter panel, sees it uses the group's frame, and downloads an 800×1000 PNG.
 * The frame file is a plain coloured band made for the test.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PASSWORD = 'card-flow-pass-1';
const LG = 'faction:lantern-guild';
const FRAME = readFileSync(new URL('./fixtures/frame-800x1000.png', import.meta.url));
// A 1×1 PNG: a real picture, but not a frame's size.
const TINY = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		viewport: { width: 1366, height: 768 },
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.9.${++lastIp}` },
		acceptDownloads: true
	});
	return ctx.newPage();
}

let owner: Page;
let player: Page;
let warbandId = '';
let fighterId = '';

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
		data: { username: 'cardkeeper', displayName: 'Keeper Mira', password: PASSWORD }
	});
	expect(accepted.status()).toBe(201);
	const w = await player.context().request.post('/api/v1/warbands', {
		data: { name: 'The Lantern Wardens', factionId: LG }
	});
	expect(w.status()).toBe(201);
	warbandId = (await w.json()).id;
	const f = await player.context().request.post(`/api/v1/warbands/${warbandId}/fighters`, {
		data: { unitId: 'unit:lantern-guild/warden', name: 'Brother Aldric Vane' }
	});
	expect(f.status()).toBe(201);
	fighterId = (await f.json()).fighters[0].id;
});

const frameRow = () => owner.locator(`tr[data-target="${LG}"]`);

test('card frames: a wrong-size file is refused; the Owner uploads a frame and gets the template', async () => {
	await owner.goto('/owner/frames');
	await expect(owner.getByRole('heading', { name: 'Card frames' })).toBeVisible();
	await expect(frameRow()).toContainText('built-in frame');
	await expect(owner.locator('tr[data-target="variant:lantern-guild/ash-wardens"]')).toContainText(
		"uses Lantern Guild's"
	);

	await frameRow()
		.locator('input[type=file]')
		.setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: TINY });
	await expect(frameRow().getByRole('alert')).toContainText('This file is 1×1');

	await frameRow()
		.locator('input[type=file]')
		.setInputFiles({ name: 'frame.png', mimeType: 'image/png', buffer: FRAME });
	await expect(owner.getByText('Frame saved.')).toBeVisible();
	await expect(frameRow()).toContainText('uploaded');
	await expect(frameRow().getByRole('button', { name: 'Remove' })).toBeVisible();

	const download = owner.waitForEvent('download');
	await owner.getByRole('button', { name: 'Download template' }).click();
	expect((await download).suggestedFilename()).toBe('frame-template.png');
});

test('a fighter card: opened from the panel, uses the group frame, downloads as an 800×1000 PNG', async () => {
	await player.goto(`/warbands/${warbandId}?sel=${fighterId}`);
	await player.getByRole('link', { name: 'Card' }).click();
	const dialog = player.getByRole('dialog', { name: 'Brother Aldric Vane' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText("your group's frame");
	await expect(dialog.locator('canvas[data-ready]')).toBeAttached();
	// The card's text is there for screen readers too.
	await expect(
		dialog.getByText('Warden · The Lantern Wardens · (Keeper Mira) · Lantern Guild')
	).toBeAttached();

	const download = player.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Download PNG' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('brother-aldric-vane-card.png');
	const bytes = readFileSync((await file.path())!);
	expect(bytes.subarray(1, 4).toString()).toBe('PNG');
	expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([800, 1000]);

	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
	await expect(player).toHaveURL(new RegExp(`sel=${fighterId}$`));
});

test('without an uploaded frame the card says it uses the built-in one', async () => {
	await frameRow().getByRole('button', { name: 'Remove' }).click();
	await expect(owner.getByText('Frame removed.')).toBeVisible();
	await player.goto(`/warbands/${warbandId}?sel=${fighterId}&card=${fighterId}`);
	await expect(player.getByRole('dialog')).toContainText('built-in frame');
});
