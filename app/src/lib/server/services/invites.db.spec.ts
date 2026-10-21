import { describe, expect, it } from 'vitest';
import { ctx, person, sql, useTestDatabase } from '../testing/db';
import { resolveSession } from './auth';
import { accept, create, pending, preview, resend, revoke } from './invites';

useTestDatabase();

const joiner = (username = 'new.player') => ({
	username,
	password: 'a long joiner password',
	displayName: 'New Player'
});

describe('creating invites (F5)', () => {
	it('owners invite admins and users', async () => {
		const owner = await person('owner');
		const a = await create(owner.ctx(), { role: 'admin' });
		const u = await create(owner.ctx(), { role: 'user', note: 'for Marta' });
		expect(a.invite.role).toBe('admin');
		expect(u.invite).toMatchObject({ role: 'user', note: 'for Marta', createdBy: owner.row.id });
		expect(u.link).toBe(`/invite/${u.token}`);
		expect(u.invite.expiresAt.getTime() - Date.now()).toBeGreaterThan(6.99 * 24 * 60 * 60 * 1000);
	});
	it('admins invite users only', async () => {
		const admin = await person('admin');
		await expect(create(admin.ctx(), { role: 'user' })).resolves.toBeTruthy();
		await expect(create(admin.ctx(), { role: 'admin' })).rejects.toMatchObject({
			code: 'forbidden',
			message: 'Only an owner can invite admins.'
		});
	});
	it('users invite nobody', async () => {
		const user = await person('user');
		await expect(create(user.ctx(), { role: 'user' })).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('stores only the token hash', async () => {
		const owner = await person('owner');
		const { token } = await create(owner.ctx(), { role: 'user' });
		expect(await sql()`select 1 from auth.invites where token_hash = ${token}`).toHaveLength(0);
	});
});

describe('accepting invites', () => {
	it('creates the account with the invite role and inviter, and signs it in', async () => {
		const admin = await person('admin');
		const { token, invite } = await create(admin.ctx(), { role: 'user' });
		const { session, user } = await accept(token, joiner('New.Player'), ctx());
		expect(user).toMatchObject({ username: 'new.player', role: 'user' });
		const [row] = await sql()`select invited_by from auth.users where id = ${user.id}`;
		expect(row!.invited_by).toBe(admin.row.id);
		expect((await resolveSession(session.token))!.user.id).toBe(user.id);
		expect(session.maxAge).toBeNull();
		const [inv] = await sql()`select used_by, used_at from auth.invites where id = ${invite.id}`;
		expect(inv!.used_by).toBe(user.id);
		expect((await preview(token)).state).toBe('used');
	});
	it('the same link twice is a conflict', async () => {
		const owner = await person('owner');
		const { token } = await create(owner.ctx(), { role: 'admin' });
		await accept(token, joiner('first.one'), ctx());
		await expect(accept(token, joiner('second.one'), ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: 'This invite was already used. Ask for a new one.'
		});
	});
	it('two people redeeming one link at once make exactly one account', async () => {
		const owner = await person('owner');
		const { token } = await create(owner.ctx(), { role: 'user' });
		const results = await Promise.allSettled([
			accept(token, joiner('racer.one'), ctx()),
			accept(token, joiner('racer.two'), ctx())
		]);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
		expect(failed.reason).toMatchObject({ code: 'conflict' });
		expect(
			(
				await sql()`select count(*)::int as n from auth.users where invited_by = ${owner.row.id}`
			)[0]!.n
		).toBe(1);
	});
	it('an expired link is a conflict', async () => {
		const owner = await person('owner');
		const { token, invite } = await create(owner.ctx(), { role: 'user' });
		await sql()`update auth.invites set expires_at = now() - interval '1 minute' where id = ${invite.id}`;
		expect((await preview(token)).state).toBe('expired');
		await expect(accept(token, joiner(), ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: 'This invite has expired. Ask for a new one.'
		});
	});
	it('a revoked link is not found', async () => {
		const owner = await person('owner');
		const { token, invite } = await create(owner.ctx(), { role: 'user' });
		await revoke(owner.ctx(), invite.id);
		expect((await preview(token)).state).toBe('revoked');
		await expect(accept(token, joiner(), ctx())).rejects.toMatchObject({ code: 'not_found' });
	});
	it('an unknown link is not found', async () => {
		expect((await preview('nothing')).state).toBe('unknown');
		await expect(accept('nothing', joiner(), ctx())).rejects.toMatchObject({ code: 'not_found' });
	});
	it('a taken username is a field error and leaves the invite open', async () => {
		const owner = await person('owner', { username: 'taken.name' });
		const { token } = await create(owner.ctx(), { role: 'user' });
		await expect(accept(token, joiner('Taken.Name'), ctx())).rejects.toMatchObject({
			code: 'invalid',
			fields: { username: 'That username is taken.' }
		});
		expect((await preview(token)).state).toBe('open');
	});
	it('a common password is refused', async () => {
		const owner = await person('owner');
		const { token } = await create(owner.ctx(), { role: 'user' });
		await expect(
			accept(token, { ...joiner(), password: 'qwertyuiop' }, ctx())
		).rejects.toMatchObject({ code: 'invalid', fields: { password: expect.any(String) } });
	});
});

describe('joining is rate limited', () => {
	it('allows 5 tries a minute per address, then asks to wait', async () => {
		const c = ctx();
		for (let i = 0; i < 5; i++)
			await expect(
				accept('guess', { ...joiner(), password: 'password123' }, c)
			).rejects.toMatchObject({ code: 'invalid' });
		const sixth = await accept('guess', joiner(), c).catch((e) => e);
		expect(sixth).toMatchObject({ code: 'rate_limited', status: 429 });
		expect(sixth.retryAfter).toBeGreaterThan(0);
		await expect(accept('guess', joiner(), ctx())).rejects.toMatchObject({ code: 'not_found' }); // another address is not affected
	});
});

describe('managing invites (F6)', () => {
	it('resend revokes the old link and makes a new one with the same role and note', async () => {
		const owner = await person('owner');
		const old = await create(owner.ctx(), { role: 'admin', note: 'for the CM' });
		const fresh = await resend(owner.ctx(), old.invite.id);
		expect(fresh.token).not.toBe(old.token);
		expect(fresh.invite).toMatchObject({ role: 'admin', note: 'for the CM' });
		await expect(accept(old.token, joiner('via.old'), ctx())).rejects.toMatchObject({
			code: 'not_found'
		});
		await expect(accept(fresh.token, joiner('via.new'), ctx())).resolves.toBeTruthy();
	});
	it('pending shows an admin their own invites and an owner all of them', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const mine = await create(admin.ctx(), { role: 'user' });
		await create(owner.ctx(), { role: 'user' });
		const used = await create(owner.ctx(), { role: 'user' });
		await accept(used.token, joiner(), ctx());
		expect((await pending(admin.ctx())).map((i) => i.id)).toEqual([mine.invite.id]);
		expect(await pending(owner.ctx())).toHaveLength(2);
	});
	it('users cannot list invites', async () => {
		const user = await person('user');
		await expect(pending(user.ctx())).rejects.toMatchObject({ code: 'forbidden' });
	});
	it('an admin cannot revoke or resend someone else’s invite', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const { invite } = await create(owner.ctx(), { role: 'user' });
		await expect(revoke(admin.ctx(), invite.id)).rejects.toMatchObject({ code: 'not_found' });
		await expect(resend(admin.ctx(), invite.id)).rejects.toMatchObject({ code: 'not_found' });
	});
	it('a used invite cannot be revoked', async () => {
		const owner = await person('owner');
		const { token, invite } = await create(owner.ctx(), { role: 'user' });
		await accept(token, joiner(), ctx());
		await expect(revoke(owner.ctx(), invite.id)).rejects.toMatchObject({ code: 'conflict' });
	});
});
