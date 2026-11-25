/**
 * The bridge to the custom server (`app/server/index.js`), which picks the port at start (PORTS in order) and,
 * before it loads the built app, leaves what it picked on `globalThis.__forgottenLettersListener`. This module is
 * the only code that reads it. Without it (`vite dev`, plain `node build`) the port is unknown here. The port never
 * changes while the app runs.
 */
import { config } from './config';

/** What the custom server picked: the port it listens on, the first port of the list, the ports it could not open. */
export interface ListenerInfo {
	readonly port: number;
	readonly wanted: number;
	readonly tried: readonly number[];
}

declare global {
	var __forgottenLettersListener: ListenerInfo | undefined;
}

const info = () => globalThis.__forgottenLettersListener;

/** The port the custom server listens on, or null when something else owns the listener. */
export const currentPort = (): number | null => info()?.port ?? null;

/** True in the Docker image, where the host's start script (or APP_PORT in .env) picks the published port. */
export const inDocker = (): boolean => config().APP_IN_DOCKER;

/**
 * After a fallback (the first port of PORTS was taken), the note for the Owner, else null. Never in Docker: inside
 * the container the port is always free, and the start script's output is the notice there.
 */
export function portNote(): string | null {
	const i = info();
	if (!i || i.port === i.wanted || inDocker()) return null;
	return `Port ${i.wanted} was in use, so the app uses ${i.port}. Links now point to ${i.port}.`;
}
