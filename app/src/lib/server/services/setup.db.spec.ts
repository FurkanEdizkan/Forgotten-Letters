import { afterEach, describe, expect, it, vi } from 'vitest';
import { ctx, person, sql, useTestDatabase } from '../testing/db';
import { resolveSession } from './auth';
import { getSettings } from './settings';
import { completeSetup, forgetSetupState, isSetupOpen, logSetupOpen } from './setup';

useTestDatabase();

const input = {
	username: 'first.owner',
	password: 'a long owner password',
	displayName: 'First Owner',
	textScale: 110,
	accent: 'brass' as const,
	port: 3000
};

afterEach(() => {
	globalThis.__forgottenLettersListener = undefined;
	vi.restoreAllMocks();
});

describe('isSetupOpen', () => {
	it('is open with no owner and closed once one exists', async () => {
		expect(await isSetupOpen()).toBe(true);
		await person('owner');
		forgetSetupState();
		expect(await isSetupOpen()).toBe(false);
	});
	it('asks the database at most every two seconds while open', async () => {
		const now = Date.now();
		const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
		expect(await isSetupOpen()).toBe(true);
		await person('owner');
		expect(await isSetupOpen()).toBe(true); // still the cached answer
		clock.mockReturnValue(now + 2500);
		expect(await isSetupOpen()).toBe(false);
	});
	it('stays closed for the process once it has seen an owner', async () => {
		await person('owner');
		expect(await isSetupOpen()).toBe(false);
		await sql()`truncate auth.users cascade`;
		expect(await isSetupOpen()).toBe(false);
	});
	it('closes right after the wizard finishes', async () => {
		expect(await isSetupOpen()).toBe(true);
		await completeSetup(input, ctx());
		expect(await isSetupOpen()).toBe(false);
	});
});

describe('logSetupOpen', () => {
	it('gives the address while setup is open, nothing after', async () => {
		expect(await logSetupOpen()).toBe('http://localhost:3000');
		await person('owner');
		forgetSetupState();
		expect(await logSetupOpen()).toBeNull();
	});
});

describe('completeSetup', () => {
	it('creates the owner, saves the look, marks setup done, signs in for 30 days and audits it', async () => {
		const c = ctx();
		const { session, user, moveTo } = await completeSetup(input, c);
		expect(user).toMatchObject({
			username: 'first.owner',
			displayName: 'First Owner',
			role: 'owner'
		});
		expect(moveTo).toBeNull();
		expect(session.maxAge).toBe(30 * 24 * 60 * 60);
		expect((await resolveSession(session.token))!.user.id).toBe(user.id);
		expect(await getSettings()).toMatchObject({ textScale: 110, accent: 'brass', port: 3000 });
		const [row] = await sql()`select setup_completed_at, updated_by from app.settings`;
		expect(row!.setup_completed_at).not.toBeNull();
		expect(row!.updated_by).toBe(user.id);
		const [audit] =
			await sql()`select action, actor_id, request_id from auth.audit_log where action = 'setup.owner_created'`;
		expect(audit).toMatchObject({ actor_id: user.id, request_id: c.requestId });
	});
	it('works only once', async () => {
		await completeSetup(input, ctx());
		await expect(
			completeSetup({ ...input, username: 'second.owner' }, ctx())
		).rejects.toMatchObject({
			code: 'conflict',
			message: 'Setup is already done. Sign in instead.'
		});
		expect((await sql()`select count(*)::int as n from auth.users`)[0]!.n).toBe(1);
	});
	it('two submits at the same moment make exactly one owner', async () => {
		const results = await Promise.allSettled([
			completeSetup({ ...input, username: 'racer.one' }, ctx()),
			completeSetup({ ...input, username: 'racer.two' }, ctx())
		]);
		expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
		const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
		expect(failed.reason).toMatchObject({ code: 'conflict' });
		expect((await sql()`select count(*)::int as n from auth.users`)[0]!.n).toBe(1);
	});
	it('refuses when an owner already exists', async () => {
		await person('owner');
		await expect(completeSetup(input, ctx())).rejects.toMatchObject({ code: 'conflict' });
		const [row] = await sql()`select setup_completed_at, text_scale from app.settings`;
		expect(row).toEqual({ setup_completed_at: null, text_scale: 100 });
	});
	it('refuses a taken username with a field message', async () => {
		await person('admin', { username: 'first.owner' });
		await expect(completeSetup(input, ctx())).rejects.toMatchObject({
			code: 'invalid',
			fields: { username: 'That username is taken.' }
		});
	});
	it('refuses a common password', async () => {
		await expect(completeSetup({ ...input, password: 'password123' }, ctx())).rejects.toMatchObject(
			{ code: 'invalid', fields: { password: expect.any(String) } }
		);
	});
	it('allows 5 tries a minute per address, then asks to wait', async () => {
		const c = ctx();
		for (let i = 0; i < 5; i++)
			await expect(completeSetup({ ...input, password: 'password123' }, c)).rejects.toMatchObject({
				code: 'invalid'
			});
		const sixth = await completeSetup(input, c).catch((e) => e);
		expect(sixth).toMatchObject({ code: 'rate_limited' });
		expect(sixth.retryAfter).toBeGreaterThan(0);
	});
	it('with a locked port, ignores the chosen port', async () => {
		const { moveTo } = await completeSetup({ ...input, port: 4400 }, ctx());
		expect(moveTo).toBeNull();
		expect((await getSettings()).port).toBe(3000);
	});
	it('with the custom server, moves to the chosen port and answers with the new address', async () => {
		const server = {
			port: 3000,
			async move(to: number) {
				server.port = to;
			}
		};
		globalThis.__forgottenLettersListener = server;
		const { moveTo } = await completeSetup(
			{ ...input, port: 4500 },
			{ ...ctx(), host: '10.1.2.3:3000' }
		);
		expect(server.port).toBe(4500);
		expect(moveTo).toBe('http://10.1.2.3:4500');
		expect((await getSettings()).port).toBe(4500);
	});
	it('a taken port rolls the whole setup back, with the reason on the port field', async () => {
		globalThis.__forgottenLettersListener = {
			port: 3000,
			move: () => Promise.reject(Object.assign(new Error('taken'), { code: 'EADDRINUSE' }))
		};
		await expect(completeSetup({ ...input, port: 4600 }, ctx())).rejects.toMatchObject({
			code: 'conflict',
			fields: { port: 'Port 4600 is in use by another program.' }
		});
		expect((await sql()`select count(*)::int as n from auth.users`)[0]!.n).toBe(0);
		expect(await isSetupOpen()).toBe(true);
	});
});
