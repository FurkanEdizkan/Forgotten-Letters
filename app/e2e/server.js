/**
 * The app as the e2e tests see it: the production build behind the custom server (`node server`, so the port can
 * move as on a real install outside Docker) on its own throwaway PostgreSQL 18 (Testcontainers), never development
 * data. Setup is open at start; the tests create the owner. The client address comes from X-Forwarded-For (as behind
 * Caddy), so each test can act from its own address and the per-address limits stay per test. The database address
 * goes to `e2e/.state/db-url` so a test can set up what the interface cannot, such as an expired seat link. The rules
 * folders are the invented test set (two core versions, an expansion, a broken folder).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const PORT = 4173;

const db = await new PostgreSqlContainer('postgres:18').start();
const state = fileURLToPath(new URL('./.state/', import.meta.url));
mkdirSync(state, { recursive: true });
writeFileSync(join(state, 'db-url'), db.getConnectionUri());
const app = spawn('node', ['server'], {
	stdio: ['ignore', 'inherit', 'inherit'],
	env: {
		...process.env,
		NODE_ENV: 'production',
		PORT: String(PORT),
		ORIGIN: `http://localhost:${PORT}`,
		DATABASE_URL: db.getConnectionUri(),
		BACKUP_DIR: mkdtempSync(join(tmpdir(), 'fl-e2e-backups-')),
		UPLOADS_DIR: mkdtempSync(join(tmpdir(), 'fl-e2e-uploads-')),
		// As the image sets it: room for a 2 MB fighter image in a multipart form.
		BODY_SIZE_LIMIT: '3M',
		RULES_DIR: fileURLToPath(new URL('../src/lib/server/testing/rules-fixture', import.meta.url)),
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
