import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ PORT_LOCKED: false }));
vi.mock('./config', () => ({ config: () => settings }));

const { currentPort, listenOnStoredPort, movePort, portLocked } = await import('./listener');
const { logger } = await import('./logger');
logger.level = 'silent';

/** A fake custom server: `fail` makes the next move reject with that errno code. */
function fakeServer(port: number) {
	const s = {
		port,
		fail: null as string | null,
		moves: [] as number[],
		async move(to: number) {
			s.moves.push(to);
			if (s.fail) throw Object.assign(new Error('listen failed'), { code: s.fail });
			s.port = to;
		}
	};
	return s;
}

beforeEach(() => {
	settings.PORT_LOCKED = false;
});
afterEach(() => {
	globalThis.__forgottenLettersListener = undefined;
});

describe('the listener bridge', () => {
	it('is locked without the custom server (vite dev, node build)', async () => {
		expect(currentPort()).toBeNull();
		expect(portLocked()).toBe(true);
		await expect(movePort(4000)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('APP_PORT in .env')
		});
	});
	it('is locked with PORT_LOCKED even when the custom server runs (Docker)', async () => {
		const s = fakeServer(3000);
		globalThis.__forgottenLettersListener = s;
		settings.PORT_LOCKED = true;
		expect(portLocked()).toBe(true);
		await expect(movePort(4000)).rejects.toMatchObject({ code: 'conflict' });
		expect(s.moves).toEqual([]);
	});
	it('moves the custom server to the new port', async () => {
		const s = fakeServer(3000);
		globalThis.__forgottenLettersListener = s;
		expect(portLocked()).toBe(false);
		await movePort(4001);
		expect(currentPort()).toBe(4001);
		await movePort(4001); // the same port again does nothing
		expect(s.moves).toEqual([4001]);
	});
	it('maps a taken port to a conflict with the reason', async () => {
		const s = fakeServer(3000);
		s.fail = 'EADDRINUSE';
		globalThis.__forgottenLettersListener = s;
		await expect(movePort(4002)).rejects.toMatchObject({
			code: 'conflict',
			message: 'Port 4002 is in use by another program.'
		});
		expect(currentPort()).toBe(3000);
	});
	it('maps a forbidden port to the admin-rights reason', async () => {
		const s = fakeServer(3000);
		s.fail = 'EACCES';
		globalThis.__forgottenLettersListener = s;
		await expect(movePort(4003)).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringContaining('admin rights')
		});
	});
	it('passes other listen errors on unchanged', async () => {
		const s = fakeServer(3000);
		s.fail = 'EINVAL';
		globalThis.__forgottenLettersListener = s;
		await expect(movePort(4004)).rejects.toMatchObject({ code: 'EINVAL' });
	});
	it('at start, moves to the stored port but never fails the start', async () => {
		const s = fakeServer(3000);
		globalThis.__forgottenLettersListener = s;
		await listenOnStoredPort(3000);
		expect(s.moves).toEqual([]);
		s.fail = 'EADDRINUSE';
		await expect(listenOnStoredPort(4005)).resolves.toBeUndefined();
		expect(currentPort()).toBe(3000);
		s.fail = null;
		await listenOnStoredPort(4006);
		expect(currentPort()).toBe(4006);
	});
});
