import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

describe('readConfig', () => {
	it('fills defaults', () => {
		const c = readConfig({ DATABASE_URL: 'postgres://u:p@h:5432/d' });
		expect(c).toMatchObject({
			NODE_ENV: 'production',
			DB_POOL_MAX: 10,
			DB_STATEMENT_TIMEOUT_MS: 5000,
			LOG_LEVEL: 'info',
			BACKUP_DIR: '/data/backups',
			BACKUP_KEEP_DAYS: 14,
			RETENTION_DAYS: 180,
			RUN_STARTUP: true,
			PORT_LOCKED: false,
			databaseUrl: 'postgres://u:p@h:5432/d'
		});
		expect(Object.isFrozen(c)).toBe(true);
	});
	it('builds DATABASE_URL from the POSTGRES_* parts, escaping them', () => {
		const c = readConfig({
			POSTGRES_PASSWORD: 'p@ss/word',
			POSTGRES_HOST: 'pg',
			POSTGRES_PORT: '6543',
			POSTGRES_USER: 'me',
			POSTGRES_DB: 'letters'
		});
		expect(c.databaseUrl).toBe('postgres://me:p%40ss%2Fword@pg:6543/letters');
	});
	it('defaults host db, user and database letters', () => {
		expect(readConfig({ POSTGRES_PASSWORD: 'x' }).databaseUrl).toBe(
			'postgres://letters:x@db:5432/letters'
		);
	});
	it('reads secrets from *_FILE', () => {
		const dir = mkdtempSync(join(tmpdir(), 'letters-config-'));
		writeFileSync(join(dir, 'pw'), 'from-file\n');
		writeFileSync(join(dir, 'url'), 'postgres://a:b@c:1/d\n');
		expect(readConfig({ POSTGRES_PASSWORD_FILE: join(dir, 'pw') }).databaseUrl).toBe(
			'postgres://letters:from-file@db:5432/letters'
		);
		expect(readConfig({ DATABASE_URL_FILE: join(dir, 'url') }).databaseUrl).toBe(
			'postgres://a:b@c:1/d'
		);
	});
	it('prefers the plain variable over its _FILE', () => {
		expect(
			readConfig({ POSTGRES_PASSWORD: 'plain', POSTGRES_PASSWORD_FILE: '/does/not/exist' })
				.databaseUrl
		).toContain(':plain@');
	});
	it('reads RUN_STARTUP false', () => {
		expect(readConfig({ POSTGRES_PASSWORD: 'x', RUN_STARTUP: 'false' }).RUN_STARTUP).toBe(false);
	});
	it('reads PORT_LOCKED as true/false or 1/0', () => {
		const locked = (v: string) =>
			readConfig({ POSTGRES_PASSWORD: 'x', PORT_LOCKED: v }).PORT_LOCKED;
		expect([locked('true'), locked('1'), locked('false'), locked('0')]).toEqual([
			true,
			true,
			false,
			false
		]);
		expect(() => locked('yes')).toThrow(/PORT_LOCKED/);
	});
	it('stops without a database setting', () => {
		expect(() => readConfig({})).toThrow(/DATABASE_URL, or POSTGRES_PASSWORD/);
	});
	it('names a bad variable but never its value', () => {
		const bad = {
			POSTGRES_PASSWORD: 'x',
			DB_POOL_MAX: 'secretvalue123',
			LOG_LEVEL: 'shout-secret',
			DATABASE_URL: 'not a url secret'
		};
		let message = '';
		try {
			readConfig(bad);
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).toMatch(/^Bad settings in \.env/);
		expect(message).toContain('DB_POOL_MAX');
		expect(message).toContain('LOG_LEVEL');
		expect(message).toContain('DATABASE_URL');
		expect(message).not.toContain('secret');
	});
	it('refuses out-of-range numbers', () => {
		expect(() => readConfig({ POSTGRES_PASSWORD: 'x', RETENTION_DAYS: '3' })).toThrow(
			/RETENTION_DAYS/
		);
		expect(() => readConfig({ POSTGRES_PASSWORD: 'x', DB_POOL_MAX: '0' })).toThrow(/DB_POOL_MAX/);
	});
});
