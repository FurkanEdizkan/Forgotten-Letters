import { describe, expect, it } from 'vitest';
import { db } from '../db';
import * as invitesRepo from '../repos/invites';
import { ctx, person, sql, useTestDatabase } from '../testing/db';
import { resolveSession } from './auth';
import { newToken, tokenHash } from './passwords';
import { checkSetupToken, completeSetup, ensureSetupLink } from './setup';

useTestDatabase();

const account = {
	username: 'first.owner',
	password: 'a long owner password',
	displayName: 'First Owner'
};
const tokenOf = (link: string) => link.split('/setup/')[1]!;

describe('ensureSetupLink', () => {
	it('makes a one-hour setup link while there is no owner', async () => {
		const link = await ensureSetupLink();
		expect(link).toMatch(/^http:\/\/localhost:3000\/setup\/[\w-]{43}$/);
		const row = await invitesRepo.findSetupToken(db(), tokenHash(tokenOf(link!)));
		expect(row!.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60 * 1000);
		expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60 * 60 * 1000);
		expect(await checkSetupToken(tokenOf(link!))).toBe(true);
	});
	it('makes nothing once an owner exists', async () => {
		await person('owner');
		expect(await ensureSetupLink()).toBeNull();
		expect((await sql()`select count(*)::int as n from auth.setup_tokens`)[0]!.n).toBe(0);
	});
});

describe('completeSetup', () => {
	it('creates the owner, signs them in for 30 days and audits it', async () => {
		const token = tokenOf((await ensureSetupLink())!);
		const c = ctx();
		const { session, user } = await completeSetup(token, account, c);
		expect(user).toMatchObject({
			username: 'first.owner',
			displayName: 'First Owner',
			role: 'owner'
		});
		expect(session.maxAge).toBe(30 * 24 * 60 * 60);
		expect((await resolveSession(session.token))!.user.id).toBe(user.id);
		const [audit] =
			await sql()`select action, actor_id, request_id from auth.audit_log where action = 'setup.owner_created'`;
		expect(audit).toMatchObject({ actor_id: user.id, request_id: c.requestId });
		expect(await checkSetupToken(token)).toBe(false);
	});
	it('works only once: the same token again is a conflict', async () => {
		const token = tokenOf((await ensureSetupLink())!);
		await completeSetup(token, account, ctx());
		await expect(
			completeSetup(token, { ...account, username: 'second.owner' }, ctx())
		).rejects.toMatchObject({ code: 'conflict' });
		expect((await sql()`select count(*)::int as n from auth.users`)[0]!.n).toBe(1);
	});
	it('refuses an expired token', async () => {
		const token = newToken();
		await invitesRepo.insertSetupToken(db(), tokenHash(token), new Date(Date.now() - 1000));
		expect(await checkSetupToken(token)).toBe(false);
		await expect(completeSetup(token, account, ctx())).rejects.toMatchObject({ code: 'conflict' });
	});
	it('refuses an unknown token', async () => {
		await expect(completeSetup(newToken(), account, ctx())).rejects.toMatchObject({
			code: 'conflict'
		});
	});
	it('refuses a second owner even with a fresh, unused token', async () => {
		const token = tokenOf((await ensureSetupLink())!);
		await person('owner');
		expect(await checkSetupToken(token)).toBe(false);
		await expect(completeSetup(token, account, ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: 'An owner already exists. Sign in instead.'
		});
	});
	it('refuses a common password', async () => {
		const token = tokenOf((await ensureSetupLink())!);
		await expect(
			completeSetup(token, { ...account, password: 'password123' }, ctx())
		).rejects.toMatchObject({ code: 'invalid', fields: { password: expect.any(String) } });
	});
	it('allows 5 tries a minute per address, then asks to wait', async () => {
		const c = ctx();
		for (let i = 0; i < 5; i++)
			await expect(
				completeSetup('guess', { ...account, password: 'password123' }, c)
			).rejects.toMatchObject({ code: 'invalid' });
		const sixth = await completeSetup('guess', account, c).catch((e) => e);
		expect(sixth).toMatchObject({ code: 'rate_limited' });
		expect(sixth.retryAfter).toBeGreaterThan(0);
	});
});
