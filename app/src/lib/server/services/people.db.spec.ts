import { describe, expect, it } from 'vitest';
import { db } from '../db';
import * as usersRepo from '../repos/users';
import { ctx, newCampaign, PASSWORD, person, sql, useTestDatabase } from '../testing/db';
import { resolveSession, signIn, signInLimiter } from './auth';
import { addCoCm, moveStage, remove } from './campaigns';
import {
	anonymise,
	changeRole,
	list,
	ownerCandidates,
	resetPassword,
	setDisabled,
	transferOwnership
} from './people';

useTestDatabase();

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

describe('changeRole (F8, decision 80)', () => {
	it('changes a role, bumps the version and audits it', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const p = await changeRole(owner.ctx(), user.row.id, 'admin', user.row.version);
		expect(p).toMatchObject({ role: 'admin', version: user.row.version + 1 });
		const [a] =
			await sql()`select actor_id, detail from auth.audit_log where action = 'role.changed'`;
		expect(a).toMatchObject({ actor_id: owner.row.id, detail: { from: 'user', to: 'admin' } });
	});
	it('never makes anyone the Owner: the role is Admin or User', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		await expect(
			// The schemas refuse "owner" first (400); the service refuses it too.
			changeRole(owner.ctx(), admin.row.id, 'owner' as never, admin.row.version)
		).rejects.toMatchObject({ code: 'invalid', fields: { role: expect.any(String) } });
		expect((await reload(admin.row.id)).role).toBe('admin');
	});
	it('never changes the Owner: ownership moves only by transfer', async () => {
		const owner = await person('owner');
		await expect(
			changeRole(owner.ctx(), owner.row.id, 'admin', owner.row.version)
		).rejects.toMatchObject({ code: 'conflict', message: 'Ownership moves only by transfer.' });
		expect((await reload(owner.row.id)).role).toBe('owner');
	});
	it('a stale version is a conflict', async () => {
		const owner = await person('owner');
		const user = await person('user');
		await changeRole(owner.ctx(), user.row.id, 'admin', user.row.version);
		await expect(
			changeRole(owner.ctx(), user.row.id, 'user', user.row.version)
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
			signIn({ username: user.row.username, password: PASSWORD, remember: false }, ctx())
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await setDisabled(owner.ctx(), user.row.id, false, p.version);
		await expect(
			signIn({ username: user.row.username, password: PASSWORD, remember: false }, ctx())
		).resolves.toBeTruthy();
		expect(
			await sql()`select action from auth.audit_log where action like 'account.%' order by id`
		).toEqual([{ action: 'account.disabled' }, { action: 'account.enabled' }]);
	});
	it('the Owner is never disabled: transfer ownership first', async () => {
		const owner = await person('owner');
		await expect(
			setDisabled(owner.ctx(), owner.row.id, true, owner.row.version)
		).rejects.toMatchObject({ code: 'conflict', message: 'Transfer ownership first.' });
		expect((await reload(owner.row.id)).disabledAt).toBeNull();
	});
	it('a stale version is a conflict', async () => {
		const owner = await person('owner');
		const user = await person('user');
		await expect(
			setDisabled(owner.ctx(), user.row.id, true, user.row.version + 5)
		).rejects.toMatchObject({ code: 'conflict' });
	});
});

describe('transferOwnership (decision 80)', () => {
	const hand = (
		from: { ctx: () => ReturnType<typeof ctx> },
		to: { row: { id: string; version: number } },
		password = PASSWORD
	) => transferOwnership(from.ctx(), { to: to.row.id, password, version: to.row.version });

	it('swaps the roles in one go, bumps both versions and audits it; nobody is signed out', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const out = await hand(owner, admin);
		expect(out.from).toMatchObject({
			id: owner.row.id,
			role: 'admin',
			version: owner.row.version + 1
		});
		expect(out.to).toMatchObject({
			id: admin.row.id,
			role: 'owner',
			version: admin.row.version + 1
		});
		expect((await reload(owner.row.id)).role).toBe('admin');
		expect((await reload(admin.row.id)).role).toBe('owner');
		const [a] =
			await sql()`select actor_id, target_id, detail from auth.audit_log where action = 'owner.transferred'`;
		expect(a).toMatchObject({
			actor_id: owner.row.id,
			target_id: admin.row.id,
			detail: { from: owner.row.id, to: admin.row.id }
		});
		expect(await resolveSession(owner.token)).not.toBeNull();
		expect(await resolveSession(admin.token)).not.toBeNull();
	});
	it('a Player can become the Owner, and the old Owner keeps running their campaigns as an Admin', async () => {
		const owner = await person('owner');
		const player = await person('user');
		const { campaign } = await newCampaign(owner);
		await hand(owner, player);
		expect((await reload(player.row.id)).role).toBe('owner');
		expect(
			await sql()`select role from campaign.members where campaign_id = ${campaign.id} and user_id = ${owner.row.id}`
		).toEqual([{ role: 'cm' }]);
	});
	it('a wrong password is a field error, changes nothing and counts towards the sign-in limit', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		await expect(hand(owner, admin, 'not my password')).rejects.toMatchObject({
			code: 'invalid',
			fields: { password: 'That is not your current password.' }
		});
		expect((await reload(owner.row.id)).role).toBe('owner');
		expect((await reload(admin.row.id)).role).toBe('admin');
		expect(await sql()`select 1 from auth.audit_log where action = 'owner.transferred'`).toEqual(
			[]
		);
		// Four more wrong tries reach the limit of five; then even the right password must wait.
		for (let i = 0; i < 4; i++)
			await expect(hand(owner, admin, 'not my password')).rejects.toMatchObject({
				code: 'invalid'
			});
		await expect(hand(owner, admin)).rejects.toMatchObject({ code: 'rate_limited' });
		signInLimiter.clear(`u:${owner.row.username}`);
		await expect(hand(owner, admin)).resolves.toBeTruthy();
	});
	it('the target is another active account at the version shown; nothing changes otherwise', async () => {
		const owner = await person('owner');
		const off = await person('admin');
		const gone = await person('user');
		const fresh = await person('admin');
		const d = await setDisabled(owner.ctx(), off.row.id, true, off.row.version);
		const g = await setDisabled(owner.ctx(), gone.row.id, true, gone.row.version);
		const a = await anonymise(owner.ctx(), gone.row.id, g.version);
		await expect(hand(owner, owner)).rejects.toMatchObject({ code: 'conflict' });
		await expect(
			hand(owner, { row: { id: off.row.id, version: d.version } })
		).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining('disabled') });
		await expect(
			hand(owner, { row: { id: gone.row.id, version: a.version } })
		).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining('anonymised') });
		await expect(
			hand(owner, { row: { id: fresh.row.id, version: fresh.row.version + 1 } })
		).rejects.toMatchObject({ code: 'conflict', message: expect.stringContaining('meanwhile') });
		await expect(
			hand(owner, { row: { id: '01900000-0000-7000-8000-000000000000', version: 1 } })
		).rejects.toMatchObject({ code: 'not_found' });
		expect((await reload(owner.row.id)).role).toBe('owner');
		expect(await sql()`select 1 from auth.users where role = 'owner'`).toHaveLength(1);
	});
	it('only the Owner hands ownership on', async () => {
		await person('owner');
		const admin = await person('admin');
		const other = await person('admin');
		await expect(hand(admin, other)).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('two transfers at once hand ownership over once', async () => {
		const owner = await person('owner');
		const a = await person('admin');
		const b = await person('admin');
		const results = await Promise.allSettled([hand(owner, a), hand(owner, b)]);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		expect(await sql()`select id from auth.users where role = 'owner'`).toHaveLength(1);
		expect((await reload(owner.row.id)).role).toBe('admin');
	});
	it('offers active accounts other than the Owner that match, with their version', async () => {
		const owner = await person('owner', { displayName: 'Ilse' });
		const anselm = await person('admin', { displayName: 'Brother Anselm' });
		const off = await person('user', { displayName: 'Anselm the Lame' });
		await setDisabled(owner.ctx(), off.row.id, true, off.row.version);
		expect(await ownerCandidates(owner.ctx(), 'anselm')).toEqual([
			{
				id: anselm.row.id,
				displayName: 'Brother Anselm',
				username: anselm.row.username,
				role: 'admin',
				version: anselm.row.version
			}
		]);
		expect(await ownerCandidates(owner.ctx(), 'ilse')).toEqual([]);
		await expect(ownerCandidates(anselm.ctx(), 'ilse')).rejects.toMatchObject({
			code: 'forbidden'
		});
	});
});

describe('one Owner in the database (decision 80)', () => {
	it('users_one_owner refuses a second Owner row', async () => {
		await person('owner');
		await expect(
			sql()`insert into auth.users (username, display_name, password_hash, role) values ('second.owner', 'Second', 'x', 'owner')`
		).rejects.toMatchObject({ constraint_name: 'users_one_owner' });
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
	it('never anonymises the Owner: transfer ownership first', async () => {
		const owner = await person('owner');
		// Only an Owner left disabled by an old copy could get this far (migration 0012 may keep one).
		await sql()`update auth.users set disabled_at = now() where id = ${owner.row.id}`;
		const o = await reload(owner.row.id);
		await expect(anonymise(owner.ctx(), owner.row.id, o.version)).rejects.toMatchObject({
			code: 'conflict',
			message: 'Transfer ownership first.'
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
