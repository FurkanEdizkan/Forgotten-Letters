/**
 * Backups with pg_dump (custom format, compressed) into BACKUP_DIR: one before migrations run, one a day, kept for
 * BACKUP_KEEP_DAYS. The owner downloads or restores them from the owner area. Needs the PostgreSQL 18 client tools
 * (pg_dump, pg_restore) in the app image.
 */
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { AppError } from '../errors';
import { config } from '../infra/config';
import { logger } from '../infra/logger';
import { db } from '../db';
import { record, type Ctx } from './audit';

const NAME = /^letters-\d{8}-\d{6}-(daily|pre-migrate|manual|pre-restore)\.dump$/;

export interface BackupFile {
	name: string;
	size: number;
	createdAt: Date;
}

/** Connection settings for the client tools, from DATABASE_URL (the password goes through the environment). */
function pgEnv(): NodeJS.ProcessEnv {
	const u = new URL(config().databaseUrl);
	return {
		...process.env,
		PGHOST: u.hostname,
		PGPORT: u.port || '5432',
		PGUSER: decodeURIComponent(u.username),
		PGPASSWORD: decodeURIComponent(u.password),
		PGDATABASE: decodeURIComponent(u.pathname.slice(1))
	};
}

function run(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const p = spawn(cmd, args, { env: pgEnv(), stdio: ['ignore', 'ignore', 'pipe'] });
		let err = '';
		p.stderr.on('data', (d) => (err += String(d)));
		p.on('error', (e) => reject(new Error(`${cmd} could not start: ${e.message}`)));
		p.on('close', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${cmd} failed (${code}): ${err.trim().slice(0, 500)}`))
		);
	});
}

const stamp = (d = new Date()) =>
	d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/** Write a dump now; returns its file name. */
export async function dump(
	reason: 'daily' | 'pre-migrate' | 'manual' | 'pre-restore'
): Promise<string> {
	const dir = config().BACKUP_DIR;
	await mkdir(dir, { recursive: true });
	const name = `letters-${stamp()}-${reason}.dump`;
	await run('pg_dump', [
		'--format=custom',
		'--compress=6',
		'--no-owner',
		'--file',
		join(dir, name)
	]);
	logger.info({ backup: name }, 'Backup written');
	return name;
}

export async function list(): Promise<BackupFile[]> {
	const dir = config().BACKUP_DIR;
	const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => NAME.test(n));
	// Stats' dates are prototype getters, so spreading a Stats object loses them; pick the fields instead.
	const files = await Promise.all(
		names.map(async (name) => {
			const s = await stat(join(dir, name));
			return { name, size: s.size, mtime: s.mtime };
		})
	);
	return files
		.map((f) => ({ name: f.name, size: f.size, createdAt: f.mtime }))
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Remove dumps older than BACKUP_KEEP_DAYS. */
export async function prune() {
	const cutoff = Date.now() - config().BACKUP_KEEP_DAYS * 24 * 60 * 60 * 1000;
	for (const f of await list())
		if (f.createdAt.getTime() < cutoff) await rm(join(config().BACKUP_DIR, f.name));
}

function requireOwner(ctx: Ctx) {
	if (ctx.actor?.role !== 'owner')
		throw new AppError('forbidden', 'Only an owner can manage backups.');
}

function safeName(name: string) {
	const n = basename(name);
	if (!NAME.test(n)) throw new AppError('not_found', 'No such backup.');
	return join(config().BACKUP_DIR, n);
}

/** A backup file to download (audited). */
export async function open(ctx: Ctx, name: string) {
	requireOwner(ctx);
	const path = safeName(name);
	const s = await stat(path).catch(() => null);
	if (!s) throw new AppError('not_found', 'No such backup.');
	await record(db(), ctx, 'backup.downloaded', null, { name: basename(path) });
	return { stream: createReadStream(path), size: s.size, name: basename(path) };
}

/** Restore a backup over the current data. A dump of the current state is written first. */
export async function restore(ctx: Ctx, name: string) {
	requireOwner(ctx);
	const path = safeName(name);
	if (!(await stat(path).catch(() => null))) throw new AppError('not_found', 'No such backup.');
	const safety = await dump('pre-restore');
	await run('pg_restore', [
		'--clean',
		'--if-exists',
		'--no-owner',
		'--single-transaction',
		'--dbname',
		pgEnv().PGDATABASE!,
		path
	]);
	await record(db(), ctx, 'backup.restored', null, { name: basename(path), safety });
	return { safety };
}
