// The host start script (start.sh at the repository root), run for real in a temp folder: a fake `docker` on PATH
// records its calls, `.env` fixtures stand in for a group's settings, and ports are held by this process so the
// script sees them in use. The wait for /health/ready is turned off (FL_WAIT_SECONDS=0): no app runs here.
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SECRET = 'not-a-real-password-but-a-secret-7Q';
const held: Server[] = [];

function hold(port = 0): Promise<number> {
	return new Promise((resolve, reject) => {
		const s = createServer();
		s.once('error', reject);
		s.listen({ host: '0.0.0.0', port }, () => {
			held.push(s);
			resolve((s.address() as { port: number }).port);
		});
	});
}
async function freePort() {
	const p = await hold();
	await new Promise<void>((r) => held.pop()!.close(() => r()));
	return p;
}

afterEach(async () => {
	await Promise.all(held.splice(0).map((s) => new Promise((r) => s.close(r))));
});

const FAKE_DOCKER = `#!/bin/sh
echo "$*" >> "$FAKE_LOG"
case "$*" in
	"compose port app 3000")
		if [ -n "$FAKE_PUBLISHED" ]; then echo "0.0.0.0:$FAKE_PUBLISHED"; exit 0; fi
		echo "no container for service app" >&2; exit 1 ;;
	"compose up -d"*) exit 0 ;;
esac
exit 0
`;

/** A temp project folder with start.sh, an optional .env and .env.example, and a fake docker. */
function project(files: { env?: string; example?: string }) {
	const dir = mkdtempSync(join(tmpdir(), 'fl-start-'));
	copyFileSync(join(ROOT, 'start.sh'), join(dir, 'start.sh'));
	chmodSync(join(dir, 'start.sh'), 0o755);
	if (files.env !== undefined) writeFileSync(join(dir, '.env'), files.env);
	if (files.example !== undefined) writeFileSync(join(dir, '.env.example'), files.example);
	mkdirSync(join(dir, 'bin'));
	writeFileSync(join(dir, 'bin', 'docker'), FAKE_DOCKER, { mode: 0o755 });
	return dir;
}

function start(dir: string, env: Record<string, string> = {}) {
	const r = spawnSync('sh', ['./start.sh'], {
		cwd: dir,
		encoding: 'utf8',
		env: {
			PATH: `${join(dir, 'bin')}:${process.env.PATH ?? ''}`,
			HOME: dir,
			FAKE_LOG: join(dir, 'docker.log'),
			FL_WAIT_SECONDS: '0',
			...env
		}
	});
	const log = existsSync(join(dir, 'docker.log'))
		? readFileSync(join(dir, 'docker.log'), 'utf8')
		: '';
	return { code: r.status, out: `${r.stdout}${r.stderr}`, docker: log };
}

const envFile = (dir: string) => readFileSync(join(dir, '.env'), 'utf8');
const line = (dir: string, key: string) =>
	envFile(dir)
		.split('\n')
		.filter((l) => l.startsWith(`${key}=`))
		.at(-1);

describe('start.sh', () => {
	it('writes the first free port and points an http ORIGIN at it, then starts Compose', async () => {
		const taken = await hold();
		const free = await freePort();
		const dir = project({
			env: `POSTGRES_PASSWORD=${SECRET}\nORIGIN=http://192.168.1.20:${taken}\nPORTS=${taken},${free}\n`
		});
		const r = start(dir);
		expect(r.code).toBe(0);
		expect(r.out).toContain(`Checking ports ${taken}, ${free}`);
		expect(r.out).toContain(`${taken} was in use; using ${free}.`);
		expect(r.out).toContain(`Updated .env: APP_PORT=${free}, ORIGIN=http://192.168.1.20:${free}`);
		expect(line(dir, 'APP_PORT')).toBe(`APP_PORT=${free}`);
		expect(line(dir, 'ORIGIN')).toBe(`ORIGIN=http://192.168.1.20:${free}`);
		expect(line(dir, 'POSTGRES_PASSWORD')).toBe(`POSTGRES_PASSWORD=${SECRET}`);
		expect(r.docker).toContain('compose up -d');
		expect(r.out).toContain(`Forgotten Letters runs at http://192.168.1.20:${free}`);
		expect(r.out).not.toContain(SECRET);
	});

	it('keeps the first port when it is free and changes nothing else', async () => {
		const free = await freePort();
		const dir = project({
			env: `POSTGRES_PASSWORD=${SECRET}\nORIGIN=http://localhost:${free}\nPORTS=${free}\n`
		});
		const r = start(dir);
		expect(r.code).toBe(0);
		expect(r.out).toContain(`Using port ${free}. .env: APP_PORT=${free}`);
		expect(line(dir, 'ORIGIN')).toBe(`ORIGIN=http://localhost:${free}`);
		expect(r.out).not.toContain(SECRET);
	});

	it('keeps a bind address and warns that links changed when the saved port is taken', async () => {
		const taken = await hold();
		const free = await freePort();
		const dir = project({
			env: `POSTGRES_PASSWORD=${SECRET}\nAPP_PORT=127.0.0.1:${taken}\nPORTS=${taken},${free}\n`
		});
		const r = start(dir);
		expect(r.code).toBe(0);
		expect(r.out).toContain(`${taken}  in use`);
		expect(r.out).toContain(
			`The saved port ${taken} is now used by another program, so the app moves to ${free}.`
		);
		expect(r.out).toContain(`Links that point to port ${taken} (invites, bookmarks) stop working.`);
		expect(line(dir, 'APP_PORT')).toBe(`APP_PORT=127.0.0.1:${free}`);
		expect(r.out).not.toContain(SECRET);
	});

	it('leaves an https ORIGIN alone', async () => {
		const taken = await hold();
		const free = await freePort();
		const dir = project({
			env: `POSTGRES_PASSWORD=${SECRET}\nORIGIN=https://letters.example.org\nPORTS=${taken},${free}\n`
		});
		const r = start(dir);
		expect(r.code).toBe(0);
		expect(line(dir, 'ORIGIN')).toBe('ORIGIN=https://letters.example.org');
		expect(line(dir, 'APP_PORT')).toBe(`APP_PORT=${free}`);
		expect(r.out).toContain(`Updated .env: APP_PORT=${free}\n`);
	});

	it('keeps the port this app’s own running container publishes', async () => {
		const ours = await hold(); // stands in for docker-proxy
		const env = `POSTGRES_PASSWORD=${SECRET}\nAPP_PORT=${ours}\nPORTS=3000,3001\n`;
		const dir = project({ env });
		const r = start(dir, { FAKE_PUBLISHED: String(ours) });
		expect(r.code).toBe(0);
		expect(r.out).toContain(`Port ${ours} is published by this app's own container: keeping it.`);
		expect(envFile(dir)).toBe(env);
		expect(r.docker).toContain('compose up -d');
	});

	it('warns and exits 1 without starting anything when every port is taken', async () => {
		const a = await hold();
		const b = await hold();
		const env = `POSTGRES_PASSWORD=${SECRET}\nPORTS=${a},${b}\n`;
		const dir = project({ env });
		const r = start(dir);
		expect(r.code).toBe(1);
		expect(r.out).toContain(`${a}  in use`);
		expect(r.out).toContain(`${b}  in use`);
		expect(r.out).toMatch(/Warning: ports .* are all in use\. The app was not started\./);
		expect(r.out).toContain('PORTS=8080,8081');
		expect(r.docker).toBe('');
		expect(envFile(dir)).toBe(env);
		expect(r.out).not.toContain(SECRET);
	});

	it('refuses a bad PORTS list with the reason', () => {
		const dir = project({ env: `POSTGRES_PASSWORD=${SECRET}\nPORTS=3000,abc\n` });
		const r = start(dir);
		expect(r.code).toBe(1);
		expect(r.out).toContain('PORTS: "abc" is not a port number.');
		expect(r.docker).toBe('');
	});

	it('without .env, makes one from .env.example with a new database password it never prints', async () => {
		const free = await freePort();
		const example = readFileSync(join(ROOT, '.env.example'), 'utf8').replace(
			/^# PORTS=.*$/m,
			`PORTS=${free}`
		);
		const dir = project({ example });
		const r = start(dir);
		expect(r.code).toBe(0);
		expect(r.out).toContain(
			'No .env yet: created it from .env.example with a new database password (not shown).'
		);
		const password = line(dir, 'POSTGRES_PASSWORD')!.slice('POSTGRES_PASSWORD='.length);
		expect(password).toMatch(/^[0-9a-f]{48}$/);
		expect(r.out).not.toContain(password);
		expect(statSync(join(dir, '.env')).mode & 0o777).toBe(0o600);
		expect(line(dir, 'APP_PORT')).toBe(`APP_PORT=${free}`);
		// The example's ORIGIN (http on 3000, the port Compose would have used) follows the port.
		expect(line(dir, 'ORIGIN')).toBe(`ORIGIN=http://localhost:${free}`);
		// Everything else is the example, unchanged.
		expect(envFile(dir).split('\n').length).toBeGreaterThan(example.split('\n').length - 1);
	});
});
