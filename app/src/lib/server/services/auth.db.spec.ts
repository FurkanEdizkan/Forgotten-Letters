import { describe, expect, it } from 'vitest';
import { db } from '../db';
import * as usersRepo from '../repos/users';
import { ctx, PASSWORD, person, sql, uniqueName, useTestDatabase } from '../testing/db';
import {
	changePassword,
	devices,
	resolveSession,
	signIn,
	signOut,
	signOutEverywhere
} from './auth';
import { tokenHash } from './passwords';

useTestDatabase();

const DAY = 24 * 60 * 60 * 1000;
const sessionsOf = async (userId: string) =>
	(await sql()`select count(*)::int as n from auth.sessions where user_id = ${userId}`)[0]!
		.n as number;

describe('signIn', () => {
	it('starts a session and audits the sign-in', async () => {
		const { row } = await person('user');
		const c = ctx();
		const { session, user } = await signIn(
			{ username: row.username.toUpperCase(), password: PASSWORD, remember: false },
			c
		);
		expect(user.id).toBe(row.id);
		expect(user.sessionHash).toBe(tokenHash(session.token));
		expect(
			await sql()`select 1 from auth.sessions where id_hash = ${tokenHash(session.token)}`
		).toHaveLength(1);
		const [a] =
			await sql()`select actor_id, target_id, ip, request_id from auth.audit_log where action = 'sign_in'`;
		expect(a).toMatchObject({
			actor_id: row.id,
			target_id: row.id,
			ip: c.ip,
			request_id: c.requestId
		});
		expect((await usersRepo.findById(db(), row.id))!.lastSignInAt).not.toBeNull();
	});
	it('gives the same message for a wrong password and an unknown username', async () => {
		const { row } = await person('user');
		const wrong = signIn(
			{ username: row.username, password: 'not the password', remember: false },
			ctx()
		);
		await expect(wrong).rejects.toMatchObject({
			code: 'unauthenticated',
			message: 'Wrong username or password.'
		});
		const unknown = signIn({ username: 'nobody.here', password: PASSWORD, remember: false }, ctx());
		await expect(unknown).rejects.toMatchObject({
			code: 'unauthenticated',
			message: 'Wrong username or password.'
		});
		expect(
			(
				await sql()`select count(*)::int as n from auth.audit_log where action = 'sign_in.failed'`
			)[0]!.n
		).toBe(2);
	});
	it('refuses a disabled account with the same message', async () => {
		const { row } = await person('user');
		await usersRepo.update(db(), row.id, { disabledAt: new Date() });
		await expect(
			signIn({ username: row.username, password: PASSWORD, remember: false }, ctx())
		).rejects.toMatchObject({ message: 'Wrong username or password.' });
		expect(await sessionsOf(row.id)).toBe(1); // only the helper's own session
	});
	it('limits a username to 5 tries a minute', async () => {
		const name = uniqueName('target');
		for (let i = 0; i < 5; i++)
			await expect(
				signIn({ username: name, password: 'wrong guess!', remember: false }, ctx())
			).rejects.toMatchObject({ code: 'unauthenticated' });
		const sixth = await signIn(
			{ username: name, password: 'wrong guess!', remember: false },
			ctx()
		).catch((e) => e);
		expect(sixth).toMatchObject({ code: 'rate_limited', status: 429 });
		expect(sixth.retryAfter).toBeGreaterThan(0);
		expect(sixth.retryAfter).toBeLessThanOrEqual(60);
	});
	it('limits an address to 5 tries a minute across usernames', async () => {
		const c = ctx();
		for (let i = 0; i < 5; i++)
			await signIn(
				{ username: uniqueName('probe'), password: 'wrong guess!', remember: false },
				c
			).catch(() => {});
		await expect(
			signIn({ username: uniqueName('probe'), password: 'wrong guess!', remember: false }, c)
		).rejects.toMatchObject({ code: 'rate_limited' });
	});
	it('counts only failures: five failures lock even the right password out', async () => {
		const { row } = await person('user');
		const c = ctx();
		for (let i = 0; i < 5; i++)
			await expect(
				signIn({ username: row.username, password: 'wrong guess!', remember: false }, ctx())
			).rejects.toMatchObject({ code: 'unauthenticated' });
		await expect(
			signIn({ username: row.username, password: PASSWORD, remember: false }, c)
		).rejects.toMatchObject({ code: 'rate_limited' });
	});
	it('never uses up the limit with successful sign-ins from one address', async () => {
		const { row } = await person('user');
		const c = ctx();
		for (let i = 0; i < 7; i++)
			await expect(
				signIn({ username: row.username, password: PASSWORD, remember: false }, c)
			).resolves.toBeTruthy();
	});
	it('remember me gives a 30-day cookie; otherwise a browser-session cookie', async () => {
		const { row } = await person('user');
		const long = await signIn(
			{ username: row.username, password: PASSWORD, remember: true },
			ctx()
		);
		expect(long.session.maxAge).toBe(30 * 24 * 60 * 60);
		const short = await signIn(
			{ username: row.username, password: PASSWORD, remember: false },
			ctx()
		);
		expect(short.session.maxAge).toBeNull();
		const [s] =
			await sql()`select expires_at from auth.sessions where id_hash = ${tokenHash(long.session.token)}`;
		expect(new Date(s!.expires_at).getTime() - Date.now()).toBeGreaterThan(29 * DAY);
	});
});

describe('resolveSession', () => {
	it('finds the user for a valid token', async () => {
		const { row, token } = await person('admin');
		const r = await resolveSession(token);
		expect(r!.user).toMatchObject({ id: row.id, role: 'admin', sessionHash: tokenHash(token) });
	});
	it('is null for no token, an unknown token or an absurdly long one', async () => {
		expect(await resolveSession(undefined)).toBeNull();
		expect(await resolveSession('nope')).toBeNull();
		expect(await resolveSession('x'.repeat(101))).toBeNull();
	});
	it('is null once the session expired', async () => {
		const { token } = await person('user');
		await sql()`update auth.sessions set expires_at = now() - interval '1 second' where id_hash = ${tokenHash(token)}`;
		expect(await resolveSession(token)).toBeNull();
	});
	it('is null for a disabled account', async () => {
		const { row, token } = await person('user');
		await usersRepo.update(db(), row.id, { disabledAt: new Date() });
		expect(await resolveSession(token)).toBeNull();
	});
	it('slides a short session forward after five minutes of use', async () => {
		const { token } = await person('user');
		const hash = tokenHash(token);
		expect((await resolveSession(token))!.renew).toBeNull();
		await sql()`update auth.sessions set expires_at = now() + interval '1 day' - interval '10 minutes' where id_hash = ${hash}`;
		const r = await resolveSession(token);
		expect(r!.renew).toEqual({ token, maxAge: null });
		const [s] = await sql()`select expires_at from auth.sessions where id_hash = ${hash}`;
		expect(new Date(s!.expires_at).getTime() - Date.now()).toBeGreaterThan(DAY - 60_000);
	});
	it('slides a remembered session about once a day', async () => {
		const { row } = await person('user');
		const { session } = await signIn(
			{ username: row.username, password: PASSWORD, remember: true },
			ctx()
		);
		const hash = tokenHash(session.token);
		expect((await resolveSession(session.token))!.renew).toBeNull();
		await sql()`update auth.sessions set expires_at = now() + interval '28 days' where id_hash = ${hash}`;
		expect((await resolveSession(session.token))!.renew).toEqual({
			token: session.token,
			maxAge: 30 * 24 * 60 * 60
		});
	});
});

describe('signing out', () => {
	it('signOut ends this session only', async () => {
		const me = await person('user');
		const other = await signIn(
			{ username: me.row.username, password: PASSWORD, remember: false },
			ctx()
		);
		await signOut(me.ctx());
		expect(await resolveSession(me.token)).toBeNull();
		expect(await resolveSession(other.session.token)).not.toBeNull();
	});
	it('signOutEverywhere keeps only this device', async () => {
		const me = await person('user');
		const other = await signIn(
			{ username: me.row.username, password: PASSWORD, remember: false },
			ctx()
		);
		await signOutEverywhere(me.ctx());
		expect(await resolveSession(other.session.token)).toBeNull();
		expect(await resolveSession(me.token)).not.toBeNull();
		expect(await devices(me.ctx())).toHaveLength(1);
	});
});

describe('changePassword', () => {
	it('refuses a wrong current password on the current field', async () => {
		const me = await person('user');
		await expect(
			changePassword(me.ctx(), 'not my password', 'a brand new password')
		).rejects.toMatchObject({
			code: 'invalid',
			fields: { current: 'That is not your current password.' }
		});
	});
	it('refuses a common password', async () => {
		const me = await person('user');
		await expect(changePassword(me.ctx(), PASSWORD, 'Password123')).rejects.toMatchObject({
			code: 'invalid',
			fields: { password: 'That password is too common. Choose another.' }
		});
	});
	it('refuses the same password again', async () => {
		const me = await person('user');
		await expect(changePassword(me.ctx(), PASSWORD, PASSWORD)).rejects.toMatchObject({
			code: 'invalid',
			fields: { password: expect.any(String) }
		});
	});
	it('changes it, ends other sessions, clears mustChangePassword and audits', async () => {
		const me = await person('user');
		await usersRepo.update(db(), me.row.id, { mustChangePassword: true });
		const other = await signIn(
			{ username: me.row.username, password: PASSWORD, remember: false },
			ctx()
		);
		await changePassword(me.ctx(), PASSWORD, 'a brand new password');
		expect(await resolveSession(other.session.token)).toBeNull();
		expect(await resolveSession(me.token)).not.toBeNull();
		expect((await usersRepo.findById(db(), me.row.id))!.mustChangePassword).toBe(false);
		await expect(
			signIn({ username: me.row.username, password: PASSWORD, remember: false }, ctx())
		).rejects.toMatchObject({ code: 'unauthenticated' });
		await expect(
			signIn(
				{ username: me.row.username, password: 'a brand new password', remember: false },
				ctx()
			)
		).resolves.toBeTruthy();
		expect(
			await sql()`select 1 from auth.audit_log where action = 'password.changed' and actor_id = ${me.row.id}`
		).toHaveLength(1);
	});
	it('needs someone signed in', async () => {
		await expect(changePassword(ctx(), 'a', 'b')).rejects.toMatchObject({
			code: 'unauthenticated'
		});
	});
});
