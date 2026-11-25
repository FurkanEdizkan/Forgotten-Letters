import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => ({ APP_IN_DOCKER: false }));
vi.mock('./config', () => ({ config: () => settings }));

const { currentPort, inDocker, portNote } = await import('./listener');

/** What the custom server leaves on globalThis once it listens. */
const listening = (port: number, wanted: number, tried: number[] = []) => {
	globalThis.__forgottenLettersListener = { port, wanted, tried };
};

beforeEach(() => {
	settings.APP_IN_DOCKER = false;
});
afterEach(() => {
	globalThis.__forgottenLettersListener = undefined;
});

describe('the port bridge', () => {
	it('knows no port without the custom server (vite dev, node build)', () => {
		expect(currentPort()).toBeNull();
		expect(portNote()).toBeNull();
	});
	it('reads the port the custom server picked', () => {
		listening(3000, 3000);
		expect(currentPort()).toBe(3000);
		expect(portNote()).toBeNull();
	});
	it('after a fallback, says which port was in use and which one links use now', () => {
		listening(3001, 3000, [3000]);
		expect(currentPort()).toBe(3001);
		expect(portNote()).toBe('Port 3000 was in use, so the app uses 3001. Links now point to 3001.');
	});
	it('never gives the note in Docker, where the start script picks the published port', () => {
		listening(3001, 3000, [3000]);
		settings.APP_IN_DOCKER = true;
		expect(inDocker()).toBe(true);
		expect(portNote()).toBeNull();
	});
});
