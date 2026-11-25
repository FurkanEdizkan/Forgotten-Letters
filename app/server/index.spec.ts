// The custom server as a process: the port pick and its messages, before the built app loads. The app itself is
// not needed: each case stops once the server has listened (or exited).
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const APP = fileURLToPath(new URL('..', import.meta.url));
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

/** Run `node server` until `until` matches its output or it exits; resolves with the output and exit code. */
function run(env: Record<string, string>, until?: RegExp) {
	return new Promise<{ out: string; code: number | null }>((resolve) => {
		const child = spawn(process.execPath, ['server'], {
			cwd: APP,
			// No database: the server must say everything it has to say before the app loads.
			env: { PATH: process.env.PATH ?? '', HOST: '0.0.0.0', NODE_ENV: 'production', ...env }
		});
		let out = '';
		let done = false;
		const finish = (code: number | null) => {
			if (done) return;
			done = true;
			child.kill('SIGKILL');
			resolve({ out, code });
		};
		const read = (b: Buffer) => {
			out += b.toString();
			if (until?.test(out)) finish(null);
		};
		child.stdout.on('data', read);
		child.stderr.on('data', read);
		child.on('exit', (code) => finish(code));
		setTimeout(() => finish(null), 15_000).unref();
	});
}

describe('node server', () => {
	it('moves past a taken port, says so, and points an http ORIGIN at the opened port', async () => {
		const taken = await hold();
		const free = await freePort();
		const { out } = await run(
			{ PORTS: `${taken},${free}`, ORIGIN: `http://192.168.1.20:${taken}` },
			/for this run/
		);
		expect(out).toContain(`Port ${taken} is in use, trying ${free}`);
		expect(out).toContain(
			`ORIGIN is http://192.168.1.20:${taken}; using http://192.168.1.20:${free} for this run`
		);
		expect(out).toContain(`Listening on http://0.0.0.0:${free}`);
	});
	it('exits 1 with one message when every port is taken', async () => {
		const a = await hold();
		const b = await hold();
		const { out, code } = await run({ PORTS: `${a},${b}` });
		expect(code).toBe(1);
		expect(out).toContain(`Port ${a} is in use, trying ${b}`);
		expect(out).toMatch(/are all in use\. Free one, or set PORTS in \.env/);
		expect(out).not.toContain('Listening on');
	});
	it('stops on a bad PORTS list before listening', async () => {
		const { out, code } = await run({ PORTS: '3000,abc' });
		expect(code).toBe(1);
		expect(out).toContain('PORTS: "abc" is not a port number.');
	});
});
