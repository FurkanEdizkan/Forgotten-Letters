/**
 * The bridge to the custom server (`app/server/index.js`), which owns the HTTP listeners. Before it loads the built
 * app, that server puts a control on `globalThis.__forgottenLettersListener`; this module is the only code that reads
 * it. Without the control (`vite dev`, plain `node build`) or with PORT_LOCKED (Docker, where Compose publishes the
 * port) the port is locked: shown, never moved.
 */
import { AppError } from '../errors';
import { config } from './config';
import { logger } from './logger';

/** What the custom server offers: the port it listens on, and a move to another one. */
export interface ListenerControl {
	readonly port: number;
	/** Listen on `port` too; resolves once it listens (the old port closes a little later), rejects with the listen error. */
	move(port: number): Promise<void>;
}

declare global {
	var __forgottenLettersListener: ListenerControl | undefined;
}

const control = () => globalThis.__forgottenLettersListener;

/** Why the port cannot move here, for people. */
export const PORT_LOCKED_MESSAGE =
	'The port is set outside the app here. With Docker, change APP_PORT in .env and restart.';

/** The port the custom server listens on, or null when something else owns the listener. */
export const currentPort = (): number | null => control()?.port ?? null;

/** True when the port cannot be changed from the UI. */
export const portLocked = () => config().PORT_LOCKED || !control();

/** Move the listener to `port`. Taken or forbidden ports become a conflict with the reason; nothing changes then. */
export async function movePort(port: number): Promise<void> {
	const c = control();
	if (!c || config().PORT_LOCKED) throw new AppError('conflict', PORT_LOCKED_MESSAGE);
	if (c.port === port) return;
	try {
		await c.move(port);
	} catch (e) {
		const code = (e as NodeJS.ErrnoException | null)?.code;
		if (code === 'EADDRINUSE')
			throw new AppError('conflict', `Port ${port} is in use by another program.`);
		if (code === 'EACCES')
			throw new AppError(
				'conflict',
				`Port ${port} needs admin rights on this computer. Pick another port.`
			);
		throw e;
	}
}

/**
 * At start: listen on the port saved in settings when it differs from the one the server started on. A failure is
 * logged and the app stays where it is, so a taken port never stops the app from starting.
 */
export async function listenOnStoredPort(port: number): Promise<void> {
	if (portLocked() || currentPort() === port) return;
	try {
		await movePort(port);
		logger.info({ port }, 'Listening on the port saved in settings');
	} catch (e) {
		logger.warn(
			{ err: e, port, current: currentPort() },
			'Could not listen on the saved port; staying on the current one'
		);
	}
}
