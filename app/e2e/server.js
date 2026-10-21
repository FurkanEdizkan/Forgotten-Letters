/**
 * The app as the e2e tests see it: the production build on its own throwaway PostgreSQL 18 (Testcontainers), never
 * development data. The first-owner setup link the app logs at start is written to `e2e/.state/setup-link` for the
 * tests. The client address comes from X-Forwarded-For (as behind Caddy), so each test can act from its own address
 * and the per-address limits stay per test.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const PORT = 4173;
const state = fileURLToPath(new URL('./.state/', import.meta.url));
mkdirSync(state, { recursive: true });

const db = await new PostgreSqlContainer('postgres:18').start();
const app = spawn('node', ['build'], {
	stdio: ['ignore', 'pipe', 'inherit'],
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

app.stdout.on('data', (chunk) => {
	const link = String(chunk).match(/https?:\/\/\S+\/setup\/[\w-]+/);
	if (link) writeFileSync(join(state, 'setup-link'), link[0]);
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
