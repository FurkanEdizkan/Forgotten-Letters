import { describe, expect, it } from 'vitest';
import { db } from '../db';
import * as usersRepo from '../repos/users';
import { ctx, newCampaign, person, sql, useTestDatabase } from '../testing/db';
import { resolveSession, signIn } from './auth';
import { addCoCm, moveStage, remove } from './campaigns';
import { anonymise, changeRole, list, resetPassword, setDisabled } from './people';

useTestDatabase();

/**
 * Run two changes so they overlap for certain: `first` starts and is held at its write to `heldId` (another
 * transaction has that row locked) while `second` runs to the end; then `first` is let go. Errors are expected.
 */
async function interleaved(
	heldId: string,
	first: () => Promise<unknown>,
	second: () => Promise<unknown>
) {
	let release!: () => void;
	let locked!: () => void;
	const held = new Promise<void>((r) => (release = r));
	const isLocked = new Promise<void>((r) => (locked = r));
	const holder = sql().begin(async (t) => {
		await t`select 1 from auth.users where id = ${heldId} for no key update`;
		locked();
		await held;
	});
	await isLocked;
	// Both changes start while a row is held, so neither can finish before the other has read the owners; then the
	// row is released and both run to the end. A correct service lets exactly one of them through.
	const one = first().catch((e) => e);
	await new Promise((r) => setTimeout(r, 300));
	const two = second().catch((e) => e);
	await new Promise((r) => setTimeout(r, 300));
	release();
	await holder;
	return Promise.all([one, two]);
}

const reload = async (id: string) => (await usersRepo.findById(db(), id))!;

describe('list (F7)', () => {
	it('owners see every account, without password hashes', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		await person('user', { invitedBy: admin.row.id });
		await person('user');
		const { items, next } = await list(owner.ctx(), { limit: 50 });
		expect(items).toHaveLength(4);
		expect(next).toBeNull();
		expect(items[0]).not.toHaveProperty('passwordHash');
	});
	it('admins see only the people they invited', async () => {
		const admin = await person('admin');
		const mine = await person('user', { invitedBy: admin.row.id });
		await person('user');
		const { items } = await list(admin.ctx(), { limit: 50 });
		expect(items.map((p) => p.id)).toEqual([mine.row.id]);
	});
	it('users may not list people', async () => {
		const user = await person('user');
		await expect(list(user.ctx(), { limit: 50 })).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('pages by id', async () => {
		const owner = await person('owner');
		for (let i = 0; i < 3; i++) await person('user');
		const first = await list(owner.ctx(), { limit: 2 });
		expect(first.next).toBe(first.items[1]!.id);
		const second = await list(owner.ctx(), { limit: 2, after: first.next! });
		expect(second.items).toHaveLength(2);
		expect(second.items.map((p) => p.id)).not.toContain(first.items[0]!.id);
	});
});

describe('changeRole (F8)', () => {
	it('changes a role, bumps the version and audits it', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const p = await changeRole(owner.ctx(), user.row.id, 'admin', user.row.version);
		expect(p).toMatchObject({ role: 'admin', version: user.row.version + 1 });
		const [a] =
			await sql()`select actor_id, detail from auth.audit_log where action = 'role.changed'`;
		expect(a).toMatchObject({ actor_id: owner.row.id, detail: { from: 'user', to: 'admin' } });
	});
	it('never demotes the last active owner', async () => {
		const owner = await person('owner');
		await expect(
			changeRole(owner.ctx(), owner.row.id, 'admin', owner.row.version)
		).rejects.toMatchObject({ code: 'conflict' });
		expect((await reload(owner.row.id)).role).toBe('owner');
	});
	it('demotes an owner while another active owner remains', async () => {
		const a = await person('owner');
		const b = await person('owner');
		await expect(changeRole(a.ctx(), b.row.id, 'user', b.row.version)).resolves.toMatchObject({
			role: 'user'
		});
	});
	it('a disabled second owner does not count', async () => {
		const a = await person('owner');
		const b = await person('owner');
		await usersRepo.update(db(), b.row.id, { disabledAt: new Date() });
		await expect(changeRole(a.ctx(), a.row.id, 'admin', a.row.version)).rejects.toMatchObject({
			code: 'conflict'
		});
	});
	it('a stale version is a conflict', async () => {
		const owner = await person('owner');
		const user = await person('user');
		await changeRole(owner.ctx(), user.row.id, 'admin', user.row.version);
		await expect(
			changeRole(owner.ctx(), user.row.id, 'owner', user.row.version)
		).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('changed this account')
		});
	});
	it('only owners change roles', async () => {
		const admin = await person('admin');
		const user = await person('user');
		await expect(
			changeRole(admin.ctx(), user.row.id, 'admin', user.row.version)
		).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('an unknown account is not found', async () => {
		const owner = await person('owner');
		await expect(
			changeRole(owner.ctx(), '01900000-0000-7000-8000-000000000000', 'admin', 1)
		).rejects.toMatchObject({ code: 'not_found' });
	});
	it('two owners demoting each other at once still leave one owner', async () => {
		const a = await person('owner');
		const b = await person('owner');
		await interleaved(
			b.row.id,
			() => changeRole(a.ctx(), b.row.id, 'user', b.row.version),
			() => changeRole(b.ctx(), a.row.id, 'user', a.row.version)
		);
		expect(await usersRepo.activeOwnerCount(db())).toBe(1);
	});
});

describe('setDisabled (F9)', () => {
	it('disables an account, ends its sessions and blocks sign-in; enabling lets it back', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const p = await setDisabled(owner.ctx(), user.row.id, true, user.row.version);
		expect(p.disabled).toBe(true);
		expect(await resolveSession(user.token)).toBeNull();
		expect(
			(await sql()`select count(*)::int as n from auth.sessions where user_id = ${user.row.id}`)[0]!
				.n
		).toBe(0);
		await expect(
			signIn(
				{ username: user.row.username, password: 'correct horse battery', remember: false },
				ctx()
			)
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await setDisabled(owner.ctx(), user.row.id, false, p.version);
		await expect(
			signIn(
				{ username: user.row.username, password: 'correct horse battery', remember: false },
				ctx()
			)
		).resolves.toBeTruthy();
		expect(
			await sql()`select action from auth.audit_log where action like 'account.%' order by id`
		).toEqual([{ action: 'account.disabled' }, { action: 'account.enabled' }]);
	});
	it('an owner cannot disable their own account', async () => {
		const owner = await person('owner');
		await expect(
			setDisabled(owner.ctx(), owner.row.id, true, owner.row.version)
		).rejects.toMatchObject({ code: 'conflict' });
	});
	it('a stale version is a conflict', async () => {
		const owner = await person('owner');
		const user = await person('user');
		await expect(
			setDisabled(owner.ctx(), user.row.id, true, user.row.version + 5)
		).rejects.toMatchObject({ code: 'conflict' });
	});
	it('two owners disabling each other at once still leave one active owner', async () => {
		const a = await person('owner');
		const b = await person('owner');
		await interleaved(
			b.row.id,
			() => setDisabled(a.ctx(), b.row.id, true, b.row.version),
			() => setDisabled(b.ctx(), a.row.id, true, a.row.version)
		);
		expect(await usersRepo.activeOwnerCount(db())).toBe(1);
	});
});

describe('campaign rights and site roles (decision 2)', () => {
	it('making an Admin a User drops their co-CM rows', async () => {
		const owner = await person('owner');
		const cm = await person('admin');
		const co = await person('admin');
		const { campaign } = await newCampaign(cm);
		await addCoCm(cm.ctx(), campaign.id, co.row.id);
		await changeRole(owner.ctx(), co.row.id, 'user', co.row.version);
		expect(await sql()`select 1 from campaign.members where user_id = ${co.row.id}`).toHaveLength(
			0
		);
	});
	it('refuses to make a CM of a campaign not ended a User, naming the campaign', async () => {
		const owner = await person('owner');
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm, { name: 'Mire of Saints' });
		await expect(changeRole(owner.ctx(), cm.row.id, 'user', cm.row.version)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('Mire of Saints')
		});
		// Owner -> Admin keeps the right to run campaigns, so it is allowed.
		const ownerCm = await person('owner');
		await newCampaign(ownerCm);
		await expect(
			changeRole(owner.ctx(), ownerCm.row.id, 'admin', ownerCm.row.version)
		).resolves.toMatchObject({ role: 'admin' });
		await moveStage(cm.ctx(), campaign.id, 'active');
		await moveStage(cm.ctx(), campaign.id, 'ended');
		await expect(changeRole(owner.ctx(), cm.row.id, 'user', cm.row.version)).resolves.toMatchObject(
			{ role: 'user' }
		);
	});
	it('a deleted campaign still restorable counts; one past the window does not', async () => {
		const owner = await person('owner');
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm, { name: 'Bone Fields' });
		await remove(cm.ctx(), campaign.id);
		await expect(changeRole(owner.ctx(), cm.row.id, 'user', cm.row.version)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('Bone Fields (deleted)')
		});
		await expect(setDisabled(owner.ctx(), cm.row.id, true, cm.row.version)).rejects.toMatchObject({
			code: 'conflict'
		});
		await sql()`update campaign.campaigns set deleted_at = now() - interval '31 days'`;
		await expect(changeRole(owner.ctx(), cm.row.id, 'user', cm.row.version)).resolves.toMatchObject(
			{ role: 'user' }
		);
	});
	it('refuses to disable a CM of a campaign not ended, and drops nothing', async () => {
		const owner = await person('owner');
		const cm = await person('admin');
		const co = await person('admin');
		const { campaign } = await newCampaign(cm, { name: 'Ash Road' });
		await addCoCm(cm.ctx(), campaign.id, co.row.id);
		await expect(setDisabled(owner.ctx(), cm.row.id, true, cm.row.version)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('Ash Road')
		});
		await setDisabled(owner.ctx(), co.row.id, true, co.row.version);
		expect(await sql()`select 1 from campaign.members where user_id = ${co.row.id}`).toHaveLength(
			1
		);
	});
});

describe('resetPassword (F10)', () => {
	it('returns a temporary password that signs in and must be changed', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const { temporary, person: p } = await resetPassword(
			owner.ctx(),
			user.row.id,
			user.row.version
		);
		expect(p.mustChangePassword).toBe(true);
		expect(await resolveSession(user.token)).toBeNull();
		const { user: signedIn } = await signIn(
			{ username: user.row.username, password: temporary, remember: false },
			ctx()
		);
		expect(signedIn.mustChangePassword).toBe(true);
		await expect(
			signIn(
				{ username: user.row.username, password: 'correct horse battery', remember: false },
				ctx()
			)
		).rejects.toMatchObject({ code: 'unauthenticated' });
	});
});

describe('anonymise (F18)', () => {
	it('needs the account disabled first', async () => {
		const owner = await person('owner');
		const user = await person('user');
		await expect(anonymise(owner.ctx(), user.row.id, user.row.version)).rejects.toMatchObject({
			code: 'conflict',
			message: 'Disable the account first.'
		});
	});
	it('renames a disabled account to Former member and keeps it', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const d = await setDisabled(owner.ctx(), user.row.id, true, user.row.version);
		const p = await anonymise(owner.ctx(), user.row.id, d.version);
		expect(p).toMatchObject({ displayName: 'Former member', anonymised: true, disabled: true });
		expect(
			await sql()`select 1 from auth.audit_log where action = 'account.anonymised' and target_id = ${user.row.id}`
		).toHaveLength(1);
	});
});
