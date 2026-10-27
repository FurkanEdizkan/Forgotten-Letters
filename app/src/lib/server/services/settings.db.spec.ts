import { afterEach, describe, expect, it } from 'vitest';
import { ctx, person, sql, useTestDatabase } from '../testing/db';
import { getAppearance, getSettings, updateSettings } from './settings';

useTestDatabase();

/** A fake custom server on `port`; `fail` makes the next move reject with that errno code. */
function fakeServer(port: number) {
	const s = {
		port,
		fail: null as string | null,
		async move(to: number) {
			if (s.fail) throw Object.assign(new Error('listen failed'), { code: s.fail });
			s.port = to;
		}
	};
	globalThis.__forgottenLettersListener = s;
	return s;
}

afterEach(() => {
	globalThis.__forgottenLettersListener = undefined;
});

const withHost = (c: ReturnType<typeof ctx>, host: string) => ({ ...c, host });

describe('getSettings', () => {
	it('gives the defaults, locked without the custom server, at the address the browser used', async () => {
		expect(await getSettings('192.168.1.20:5173')).toEqual({
			textScale: 100,
			accent: 'blood',
			port: 3000,
			portLocked: true,
			address: 'http://192.168.1.20:5173'
		});
		expect(await getAppearance()).toEqual({ textScale: 100, accent: 'blood' });
	});
	it('with the custom server: unlocked, the address uses the port it listens on', async () => {
		fakeServer(3100);
		expect(await getSettings('192.168.1.20:3100')).toMatchObject({
			portLocked: false,
			address: 'http://192.168.1.20:3100'
		});
		expect((await getSettings()).address).toBe('http://localhost:3100');
	});
});

describe('updateSettings', () => {
	it('lets an owner change the look, audits only what changed, and every page sees it', async () => {
		const o = await person('owner');
		await getAppearance(); // fill the cache first: the change must replace it
		const { settings, moveTo } = await updateSettings(
			{ textScale: 115, accent: 'verdigris' },
			o.ctx()
		);
		expect(settings).toMatchObject({ textScale: 115, accent: 'verdigris' });
		expect(moveTo).toBeNull();
		expect(await getAppearance()).toEqual({ textScale: 115, accent: 'verdigris' });
		const [row] = await sql()`select updated_by from app.settings`;
		expect(row!.updated_by).toBe(o.row.id);
		const audit =
			await sql()`select action, detail from auth.audit_log where action = 'settings.changed'`;
		expect(audit).toEqual([
			{
				action: 'settings.changed',
				detail: {
					textScale: { from: 100, to: 115 },
					accent: { from: 'blood', to: 'verdigris' }
				}
			}
		]);
		await updateSettings({ accent: 'verdigris' }, o.ctx());
		expect((await sql()`select count(*)::int as n from auth.audit_log`)[0]!.n).toBe(1);
	});
	it('refuses anyone but an owner', async () => {
		for (const role of ['admin', 'user'] as const) {
			const p = await person(role);
			await expect(updateSettings({ accent: 'ash' }, p.ctx())).rejects.toMatchObject({
				code: 'forbidden'
			});
		}
		await expect(updateSettings({ accent: 'ash' }, ctx())).rejects.toMatchObject({
			code: 'unauthenticated'
		});
		expect((await getAppearance()).accent).toBe('blood');
	});
	it('refuses a port change while the port is locked, and saves nothing of that change', async () => {
		const o = await person('owner');
		await expect(updateSettings({ accent: 'ash', port: 4100 }, o.ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('APP_PORT in .env'),
			fields: { port: expect.any(String) }
		});
		expect(await getSettings()).toMatchObject({ accent: 'blood', port: 3000 });
		// Sending the port it already has is no change, so it is fine even when locked.
		await expect(updateSettings({ port: 3000 }, o.ctx())).resolves.toMatchObject({
			moveTo: null
		});
	});
	it('moves the listener and answers with the new address', async () => {
		const o = await person('owner');
		const server = fakeServer(3000);
		const { settings, moveTo } = await updateSettings(
			{ port: 4200 },
			withHost(o.ctx(), '192.168.1.20:3000')
		);
		expect(server.port).toBe(4200);
		expect(moveTo).toBe('http://192.168.1.20:4200');
		expect(settings).toMatchObject({ port: 4200, address: 'http://192.168.1.20:4200' });
	});
	it('keeps everything when the new port is taken', async () => {
		const o = await person('owner');
		const server = fakeServer(3000);
		server.fail = 'EADDRINUSE';
		await expect(updateSettings({ textScale: 120, port: 4300 }, o.ctx())).rejects.toMatchObject({
			code: 'conflict',
			message: 'Port 4300 is in use by another program.',
			fields: { port: 'Port 4300 is in use by another program.' }
		});
		expect(await getSettings()).toMatchObject({ textScale: 100, port: 3000 });
		expect((await sql()`select count(*)::int as n from auth.audit_log`)[0]!.n).toBe(0);
	});
});

describe('app.settings in the database', () => {
	it('holds exactly one row', async () => {
		await expect(sql()`insert into app.settings (id) values (2)`).rejects.toMatchObject({
			constraint_name: 'settings_single_row'
		});
		await expect(sql()`insert into app.settings (id) values (1)`).rejects.toMatchObject({
			code: '23505'
		});
	});
	it('refuses out-of-range values even when written by hand', async () => {
		const bad = [
			[() => sql()`update app.settings set text_scale = 85`, 'settings_text_scale_range'],
			[() => sql()`update app.settings set text_scale = 135`, 'settings_text_scale_range'],
			[() => sql()`update app.settings set text_scale = 102`, 'settings_text_scale_range'],
			[() => sql()`update app.settings set accent = 'pink'`, 'settings_accent_preset'],
			[() => sql()`update app.settings set port = 80`, 'settings_port_range'],
			[() => sql()`update app.settings set port = 70000`, 'settings_port_range']
		] as const;
		for (const [query, constraint] of bad)
			await expect(query()).rejects.toMatchObject({ constraint_name: constraint });
		await sql()`update app.settings set text_scale = 130, accent = 'ash', port = 65535`;
		await sql()`update app.settings set text_scale = 90, port = 1024`;
	});
	it('moves updated_at on every update and forgets who changed it when they go', async () => {
		const o = await person('owner');
		await sql()`update app.settings set updated_at = '2000-01-01', updated_by = ${o.row.id}`;
		const [r] = await sql()`select extract(year from updated_at)::int as y from app.settings`;
		expect(r!.y).not.toBe(2000);
		await sql()`delete from auth.users where id = ${o.row.id}`;
		const [after] = await sql()`select updated_by from app.settings`;
		expect(after!.updated_by).toBeNull();
	});
});
