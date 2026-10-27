/**
 * The app as the e2e tests see it: the production build behind the custom server (`node server`, so the port can
 * move as on a real install outside Docker) on its own throwaway PostgreSQL 18 (Testcontainers), never development
 * data. Setup is open at start; the tests create the owner. The client address comes from X-Forwarded-For (as behind
 * Caddy), so each test can act from its own address and the per-address limits stay per test.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const PORT = 4173;

const db = await new PostgreSqlContainer('postgres:18').start();
const app = spawn('node', ['server'], {
	stdio: ['ignore', 'inherit', 'inherit'],
	env: {
		...process.env,
		NODE_ENV: 'production',
		PORT: String(PORT),
		ORIGIN: `http://localhost:${PORT}`,
		DATABASE_URL: db.getConnectionUri(),
		BACKUP_DIR: mkdtempSync(join(tmpdir(), 'fl-e2e-backups-')),
		LOG_LEVEL: 'info',
		ADDRESS_HEADER: 'X-Forwarded-For',
		XFF_DEPTH: '1'
	}
});

const stop = async () => {
	app.kill('SIGTERM');
	await db.stop().catch(() => {});
	process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
app.on('exit', (code) => {
	if (code) {
		console.error(`app exited with ${code}`);
		void db.stop().finally(() => process.exit(1));
	}
});
