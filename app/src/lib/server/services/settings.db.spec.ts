import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetConfig } from '../infra/config';
import { ctx, person, sql, useTestDatabase } from '../testing/db';
import { getAppearance, getSettings, runsInDocker, updateSettings } from './settings';

useTestDatabase();

/** What the custom server leaves on globalThis once it listens. */
const listening = (port: number, wanted = port) => {
	globalThis.__forgottenLettersListener = { port, wanted, tried: port === wanted ? [] : [wanted] };
};

afterEach(() => {
	globalThis.__forgottenLettersListener = undefined;
	vi.unstubAllEnvs();
	forgetConfig();
});

describe('getSettings', () => {
	it('gives the defaults at the address the browser used, with its port', async () => {
		expect(await getSettings('192.168.1.20:5173')).toEqual({
			textScale: 100,
			accent: 'blood',
			port: 5173,
			address: 'http://192.168.1.20:5173',
			portNote: null
		});
		expect(await getAppearance()).toEqual({ textScale: 100, accent: 'blood' });
	});
	it('without a Host header, the port the custom server listens on (or 3000)', async () => {
		expect(await getSettings()).toMatchObject({ address: 'http://localhost:3000', port: 3000 });
		listening(3100);
		expect(await getSettings()).toMatchObject({ address: 'http://localhost:3100', port: 3100 });
	});
	it('after a fallback, adds the note; the port is the one of the shown address', async () => {
		listening(3001, 3000);
		expect(await getSettings('192.168.1.20:3001')).toEqual({
			textScale: 100,
			accent: 'blood',
			port: 3001,
			address: 'http://192.168.1.20:3001',
			portNote: 'Port 3000 was in use, so the app uses 3001. Links now point to 3001.'
		});
	});
	it('ORIGIN wins over the Host header, and its port is shown (443 for https without one)', async () => {
		vi.stubEnv('ORIGIN', 'http://192.168.1.20:3002/');
		forgetConfig();
		listening(3000); // inside Docker: the container port is never shown
		expect(await getSettings('127.0.0.1:3000')).toMatchObject({
			address: 'http://192.168.1.20:3002',
			port: 3002
		});
		vi.stubEnv('ORIGIN', 'https://letters.example.org');
		forgetConfig();
		expect(await getSettings('127.0.0.1:3000')).toMatchObject({
			address: 'https://letters.example.org',
			port: 443
		});
	});
	it('in Docker, never a fallback note', async () => {
		vi.stubEnv('APP_IN_DOCKER', '1');
		forgetConfig();
		listening(3001, 3000);
		expect((await getSettings('192.168.1.20:3001')).portNote).toBeNull();
		expect(runsInDocker()).toBe(true);
	});
});

describe('updateSettings', () => {
	it('lets an owner change the look, audits only what changed, and every page sees it', async () => {
		const o = await person('owner');
		await getAppearance(); // fill the cache first: the change must replace it
		const settings = await updateSettings({ textScale: 115, accent: 'verdigris' }, o.ctx());
		expect(settings).toMatchObject({ textScale: 115, accent: 'verdigris' });
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
	it('takes no port: the audit never holds one', async () => {
		const o = await person('owner');
		await updateSettings({ accent: 'ash', port: 4100 } as never, o.ctx());
		const [audit] =
			await sql()`select detail from auth.audit_log where action = 'settings.changed'`;
		expect(audit!.detail).toEqual({ accent: { from: 'blood', to: 'ash' } });
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
			[() => sql()`update app.settings set accent = 'pink'`, 'settings_accent_preset']
		] as const;
		for (const [query, constraint] of bad)
			await expect(query()).rejects.toMatchObject({ constraint_name: constraint });
		await sql()`update app.settings set text_scale = 130, accent = 'ash'`;
		await sql()`update app.settings set text_scale = 90`;
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
