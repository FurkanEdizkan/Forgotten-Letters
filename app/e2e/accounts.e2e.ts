/**
 * Step 1 and 1.5 flows end to end, each with its happy path and main error path: first start (the setup wizard), sign-in, invite and join,
 * managing people, transferring ownership, sessions. The flows build on each other (the owner made in the first one
 * invites the others), so the file runs in order. Each visitor gets its own browser context and client address.
 */
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OWNER = { username: 'warden', password: 'lantern-of-ash-77' };
const PLAYER_PASSWORD = 'trench-player-pass';

let lastIp = 0;
async function visitor(browser: Browser) {
	const ctx = await browser.newContext({
		extraHTTPHeaders: { 'X-Forwarded-For': `10.0.0.${++lastIp}` }
	});
	return ctx.newPage();
}

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.fill('input[name=username]', username);
	await page.fill('input[name=password]', password);
	await page.click('button[type=submit]');
}

async function fillAccount(page: Page, username: string, displayName: string, password: string) {
	await page.fill('input[name=username]', username);
	await page.fill('input[name=displayName]', displayName);
	await page.fill('input[name=password]', password);
}

async function newInvite(page: Page, role: 'admin' | 'user', note: string) {
	const box = page.locator('input[readonly]');
	const before = (await box.count()) ? await box.inputValue() : '';
	const roleSelect = page.locator('select[name=role]');
	if (await roleSelect.count()) await roleSelect.selectOption(role);
	await page.fill('input[name=note]', note);
	await page.click('form[action="?/create"] button[type=submit]');
	// The box keeps the previous link until the new one arrives.
	await expect(box).not.toHaveValue(before);
	await expect(box).toHaveValue(/\/invite\//);
	return box.inputValue();
}

let owner: Page;
let adminInvite = '';

// First start runs through the real wizard: welcome, Setup, the three steps, Finish. The API's own error paths are
// checked beside it, since the wizard posts to the same service.
test('first start: welcome and the setup wizard make the owner, then setup is refused', async ({
	browser
}) => {
	const page = await visitor(browser);
	await page.goto('/login');
	await expect(page).toHaveURL(/\/welcome$/);
	const api = page.context().request;
	expect(await (await api.get('/api/v1/me')).json()).toMatchObject({
		error: { code: 'conflict', message: 'Setup is not done yet.' }
	});
	const weak = await api.post('/api/v1/setup', {
		data: {
			username: 'x.user',
			displayName: 'X',
			password: 'short',
			textScale: 100,
			accent: 'blood'
		}
	});
	expect(weak.status()).toBe(400);
	expect((await weak.json()).error.fields.password).toBeTruthy();

	await page.getByRole('link', { name: /Setup/ }).click();
	await expect(page).toHaveURL(/\/setup$/);

	// Step 1, error path first: a short password stays on the step with the reason under the field.
	await fillAccount(page, OWNER.username, 'Brother Anselm', 'short');
	await page.getByLabel('Repeat password').fill('short');
	await page.getByRole('button', { name: 'Next' }).click();
	await expect(page.getByText(/at least 10 characters/i)).toBeVisible();
	await page.fill('input[name=password]', OWNER.password);
	await page.getByLabel('Repeat password').fill(OWNER.password);
	await page.getByRole('button', { name: 'Next' }).click();

	// Step 2: pick an accent straight away, while the step is still sliding in; the right half must not scroll
	// (a focused control inside a clipped container once dragged the whole step out of view). Then the slider.
	await page.getByRole('radio', { name: 'Verdigris' }).click();
	await page.waitForTimeout(500);
	const offset = await page.evaluate(() =>
		[...document.querySelectorAll('*')].reduce((n, el) => n + el.scrollLeft + el.scrollTop, 0)
	);
	expect(offset).toBe(0);
	const slider = page.locator('input[name=textScale]');
	await expect(slider).toBeVisible();
	await slider.fill('110');
	await page.getByRole('button', { name: 'Next' }).click();

	// Step 3, Done: three steps only (no port step); the summary shows the address people will use (ORIGIN here).
	await expect(
		page.getByRole('list', { name: 'Setup progress' }).getByRole('listitem')
	).toHaveCount(3);
	await expect(page.locator('input[name=port]')).toHaveCount(0);
	await expect(page.locator('.summary')).toContainText('http://localhost:4173');
	await page.getByRole('button', { name: 'Finish' }).click();
	await expect(page).toHaveURL(/\/owner$/);
	await expect(page.locator('html')).toHaveAttribute('data-accent', 'verdigris');
	owner = page;

	// Setup works once; afterwards the setup pages lead to sign-in.
	const other = await visitor(browser);
	const again = await other.context().request.post('/api/v1/setup', {
		data: {
			username: 'second.owner',
			displayName: 'Second',
			password: OWNER.password,
			textScale: 100,
			accent: 'blood'
		}
	});
	expect(again.status()).toBe(409);
	await other.goto('/setup');
	await expect(other).toHaveURL(/\/login$/);
	await other.goto('/welcome');
	await expect(other).toHaveURL(/\/login$/);
});

test('sign-in: wrong password and unknown name get the same message; the sixth try is refused', async ({
	browser
}) => {
	const page = await visitor(browser);
	await page.goto('/owner');
	await expect(page).toHaveURL(/\/login\?next=%2Fowner/);

	for (const name of ['warden', 'nobody-at-all']) {
		await signIn(page, name, 'wrong-password-123');
		await expect(page.getByText('Wrong username or password.')).toBeVisible();
	}
	for (let i = 0; i < 3; i++) {
		await signIn(page, 'warden', 'wrong-password-123');
		await expect(page.getByText('Wrong username or password.')).toBeVisible();
	}
	await signIn(page, 'warden', OWNER.password);
	await expect(page.getByText(/Too many tries/)).toBeVisible();

	// From another address the owner still gets in, and `next` is honoured.
	const other = await visitor(browser);
	await other.goto('/login?next=/owner/audit');
	await other.fill('input[name=username]', OWNER.username);
	await other.fill('input[name=password]', OWNER.password);
	await other.click('button[type=submit]');
	await other.waitForURL('/owner/audit');
});

test('invites: an admin and a user join; used and withdrawn links are refused', async ({
	browser
}) => {
	await owner.goto('/owner/invites');
	adminInvite = await newInvite(owner, 'admin', 'For Sister Ilse');
	const spare = await newInvite(owner, 'user', 'Spare link');
	const row = owner.locator('tr', { hasText: 'Spare link' });
	await row.getByRole('button', { name: 'Revoke' }).click();
	await row.getByRole('button', { name: 'Really revoke?' }).click();
	await expect(owner.locator('tr', { hasText: 'Spare link' })).toHaveCount(0);

	const admin = await visitor(browser);
	await admin.goto(adminInvite);
	await fillAccount(admin, 'ilse', 'Sister Ilse', 'carcass-front-cm-1');
	await admin.click('button[type=submit]');
	await admin.waitForURL('/admin');

	const userInvite = await newInvite(admin, 'user', 'Kasimir');
	const user = await visitor(browser);
	await user.goto(userInvite);
	await fillAccount(user, 'kasimir', 'Kasimir the Pilgrim', PLAYER_PASSWORD);
	await user.click('button[type=submit]');
	await user.waitForURL('/home');

	const late = await visitor(browser);
	await late.goto(adminInvite);
	await expect(late.getByText('This invite was already used.')).toBeVisible();
	await late.goto(spare);
	await expect(late.getByText('This invite was withdrawn.')).toBeVisible();
});

test('invites: one link accepted twice at once makes one account', async ({ browser }) => {
	await owner.goto('/owner/invites');
	const link = await newInvite(owner, 'user', 'Twice');
	const [a, b] = [await visitor(browser), await visitor(browser)];
	await a.goto(link);
	await b.goto(link);
	await fillAccount(a, 'twin-a', 'Twin A', PLAYER_PASSWORD);
	await fillAccount(b, 'twin-b', 'Twin B', PLAYER_PASSWORD);
	// Forms update in place and the winner is sent on from the browser, so wait for each page's own outcome
	// (its new home, or a refusal on the invite page) instead of the network going quiet.
	const outcome = (p: Page) =>
		Promise.race([
			p.waitForURL('/home').then(() => 'joined'),
			p
				.getByRole('alert')
				.first()
				.waitFor()
				.then(() => 'refused')
		]);
	await Promise.all([a.click('button[type=submit]'), b.click('button[type=submit]')]);
	const results = await Promise.all([outcome(a), outcome(b)]);
	expect(results.sort()).toEqual(['joined', 'refused']);

	await owner.goto('/owner');
	await expect(owner.locator('tr', { hasText: /twin-[ab]/ })).toHaveCount(1);
});

test('people: a user is kept out of the owner area; disabling signs them out', async ({
	browser
}) => {
	const user = await visitor(browser);
	await signIn(user, 'kasimir', PLAYER_PASSWORD);
	await user.waitForURL('/home');
	await user.goto('/owner');
	await expect(user.getByText('This area is not open to your role.')).toBeVisible();

	await owner.goto('/owner');
	const row = owner.locator('tr', { hasText: 'kasimir' });
	await row.getByRole('button', { name: 'Disable' }).click();
	await row.getByRole('button', { name: 'Really disable?' }).click();
	await expect(owner.getByText(/signed out everywhere/)).toBeVisible();

	await user.goto('/home');
	await expect(user).toHaveURL(/\/login/);
	await signIn(user, 'kasimir', PLAYER_PASSWORD);
	await expect(user.getByText('Wrong username or password.')).toBeVisible();
});

test('people: a reset forces a new password; the Owner row has no role list, others offer two roles', async ({
	browser
}) => {
	await owner.goto('/owner');
	const row = owner.locator('tr', { hasText: 'ilse' });
	await row.getByRole('button', { name: 'Reset password' }).click();
	await row.getByRole('button', { name: 'Really reset?' }).click();
	await expect(owner.getByText(/Temporary password for/)).toBeVisible();
	const temp = await owner.locator('input[readonly]').inputValue();

	const admin = await visitor(browser);
	await signIn(admin, 'ilse', temp);
	await admin.waitForURL('/account/password');
	await admin.goto('/admin');
	await expect(admin).toHaveURL(/\/account\/password$/);
	await admin.fill('input[name=current]', temp);
	await admin.fill('input[name=password]', 'carcass-front-cm-2');
	await admin.click('main button[type=submit]');
	await admin.waitForURL('/admin');

	// One Owner (decision 80): their row has a lock tag instead of the role list, and no Disable or Anonymise.
	await owner.goto('/owner');
	const me = owner.locator('tr', { hasText: OWNER.username });
	await expect(me.getByText('Owner (transfer only)')).toBeVisible();
	await expect(me.locator('select')).toHaveCount(0);
	await expect(me.getByRole('button', { name: /Disable|Anonymise/ })).toHaveCount(0);
	await expect(me.getByRole('button', { name: 'Reset password' })).toBeVisible();
	await expect(owner.locator('tr', { hasText: 'ilse' }).locator('select option')).toHaveText([
		'Campaign Master',
		'Player'
	]);
	// The API refuses the Owner role, and any change to the Owner.
	const api = owner.context().request;
	const people: { id: string; username: string; version: number }[] = (
		await (await api.get('/api/v1/users')).json()
	).items;
	const ilse = people.find((p) => p.username === 'ilse')!;
	const self = people.find((p) => p.username === OWNER.username)!;
	const toOwner = await api.patch(`/api/v1/users/${ilse.id}`, {
		data: { role: 'owner', version: ilse.version }
	});
	expect(toOwner.status()).toBe(400);
	const demote = await api.patch(`/api/v1/users/${self.id}`, {
		data: { role: 'admin', version: self.version }
	});
	expect(demote.status()).toBe(409);
	expect((await demote.json()).error.message).toBe('Ownership moves only by transfer.');
});

test('transfer ownership: a wrong password is refused; the Owner hands over to an Admin, who hands it back', async ({
	browser
}) => {
	await owner.goto('/owner');
	const panel = owner.getByRole('region', { name: 'Transfer ownership' });
	await panel.getByLabel('New Owner').fill('ilse');
	await panel.getByRole('button', { name: 'Find' }).click();
	await expect(panel.getByRole('radio', { name: /Sister Ilse/ })).toBeChecked();
	const confirm = 'Sister Ilse becomes the Owner. You become a Campaign Master.';

	// Error path: a wrong password changes nothing and says so under the field.
	await panel.getByLabel('Your password').fill('not-my-password-1');
	await panel.getByRole('button', { name: 'Transfer ownership' }).click();
	await panel.getByRole('button', { name: confirm }).click();
	await expect(panel.getByText('That is not your current password.')).toBeVisible();
	await expect(owner).toHaveURL(/\/owner(\?|$)/);

	// The password and a second press hand the copy over; the old Owner lands on /admin as a Campaign Master.
	await panel.getByLabel('Your password').fill(OWNER.password);
	await panel.getByRole('button', { name: 'Transfer ownership' }).click();
	await panel.getByRole('button', { name: confirm }).click();
	await owner.waitForURL('/admin');
	await expect(
		owner.getByText('You handed ownership to Sister Ilse. You are now a Campaign Master.')
	).toBeVisible();
	await owner.goto('/owner');
	await expect(owner.getByText('This area is not open to your role.')).toBeVisible();

	// The new Owner sees Owner → People, and hands the copy back through the API.
	const ilse = await visitor(browser);
	await signIn(ilse, 'ilse', 'carcass-front-cm-2');
	await ilse.waitForURL('/owner');
	await expect(ilse.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
	await expect(
		ilse.locator('tr', { hasText: 'ilse' }).getByText('Owner (transfer only)')
	).toBeVisible();
	const api = ilse.context().request;
	const people: { id: string; username: string; role: string; version: number }[] = (
		await (await api.get('/api/v1/users')).json()
	).items;
	const warden = people.find((p) => p.username === OWNER.username)!;
	expect(warden.role).toBe('admin');
	const back = await api.post('/api/v1/owner/transfer', {
		data: { to: warden.id, password: 'carcass-front-cm-2', version: warden.version }
	});
	expect(back.status()).toBe(200);
	expect((await back.json()).to).toMatchObject({ username: OWNER.username, role: 'owner' });
	await owner.goto('/owner');
	await expect(owner.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
});

test('sessions: sign out other devices ends them; sign out ends this one', async ({ browser }) => {
	const laptop = await visitor(browser);
	await signIn(laptop, OWNER.username, OWNER.password);
	await laptop.waitForURL('/owner');

	await owner.goto('/account');
	await owner.getByRole('button', { name: 'Sign out other devices' }).click();
	await owner.getByRole('button', { name: 'Sign out all others?' }).click();
	await expect(owner.getByText(/were signed out/)).toBeVisible();
	await laptop.goto('/owner');
	await expect(laptop).toHaveURL(/\/login/);

	// Sign out lives in the user menu of the app shell.
	await owner.getByRole('button', { name: /^Account menu for/ }).click();
	await owner.getByRole('menuitem', { name: 'Log out' }).click();
	await owner.waitForURL('/login');
	await owner.goto('/owner');
	await expect(owner).toHaveURL(/\/login/);
});
