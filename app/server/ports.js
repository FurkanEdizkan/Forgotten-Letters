// The port list and the start-time port pick for the custom server (server/index.js). Pure apart from the listen
// function it is given, so it is unit-tested with real sockets (ports.spec.ts). The host start scripts (start.sh,
// start.ps1) do the same pick before Docker starts, with the same wording.

/** The ports tried when PORTS is unset: 3000, then five backups. */
export const DEFAULT_PORTS = [3000, 3001, 3002, 3003, 3004, 3005];

/** The example in every "all taken" message. */
const EXAMPLE = 'PORTS=8080,8081';

/**
 * The ports to try, in order: PORTS (comma-separated), else the legacy PORT alone, else DEFAULT_PORTS. A bad list
 * throws with the reason, so the server stops before it listens anywhere.
 * @param {Record<string, string | undefined>} env
 * @returns {number[]}
 */
export function parsePorts(env) {
	const list = env.PORTS?.trim();
	if (list) return parseList('PORTS', list.split(','));
	const one = env.PORT?.trim();
	if (one) return parseList('PORT', [one]);
	return [...DEFAULT_PORTS];
}

/**
 * @param {string} name
 * @param {string[]} parts
 */
function parseList(name, parts) {
	/** @type {number[]} */
	const out = [];
	for (const raw of parts) {
		const v = raw.trim();
		if (!v) throw new Error(`${name}: an entry is empty. Use a list like ${EXAMPLE}.`);
		if (!/^\d+$/.test(v)) throw new Error(`${name}: "${v}" is not a port number.`);
		const p = Number(v);
		if (p < 1 || p > 65535) throw new Error(`${name}: ${p} is out of range (1 to 65535).`);
		if (out.includes(p)) throw new Error(`${name}: ${p} is listed twice.`);
		out.push(p);
	}
	return out;
}

/**
 * Ports for people: a run of consecutive ports as "3000–3005", anything else as a list.
 * @param {number[]} ports
 */
export function describePorts(ports) {
	const run = ports.length > 1 && ports.every((p, i) => i === 0 || p === ports[i - 1] + 1);
	return run ? `${ports[0]}–${ports.at(-1)}` : ports.join(', ');
}

/**
 * The message when no port in the list could be opened.
 * @param {number[]} ports
 */
export function allTakenMessage(ports) {
	const what =
		ports.length === 1
			? `Port ${ports[0]} is in use. Free it`
			: `Ports ${describePorts(ports)} are all in use. Free one`;
	return `${what}, or set PORTS in .env (for example ${EXAMPLE}).`;
}

/**
 * Listen on the first port of `ports` that can be opened. A taken (EADDRINUSE) or forbidden (EACCES) port is
 * reported through `warn` and the next one is tried; any other listen error is passed on. When none can be
 * opened it throws an error with code EALLPORTSTAKEN, the ports and the message for people.
 * @param {number[]} ports
 * @param {(port: number) => Promise<unknown>} tryListen resolves once listening, rejects with the listen error
 * @param {(message: string) => void} warn
 * @returns {Promise<{ port: number, wanted: number, tried: number[] }>} the opened port, the first port of the
 *   list, and the ports before it that could not be opened
 */
export async function pickPort(ports, tryListen, warn) {
	/** @type {number[]} */
	const tried = [];
	for (const [i, port] of ports.entries()) {
		try {
			await tryListen(port);
			return { port, wanted: ports[0], tried };
		} catch (e) {
			const code = /** @type {NodeJS.ErrnoException} */ (e)?.code;
			if (code !== 'EADDRINUSE' && code !== 'EACCES') throw e;
			tried.push(port);
			const next = ports[i + 1];
			if (next !== undefined) {
				const why = code === 'EACCES' ? 'needs admin rights' : 'is in use';
				warn(`Port ${port} ${why}, trying ${next}`);
			}
		}
	}
	throw Object.assign(new Error(allTakenMessage(ports)), { code: 'EALLPORTSTAKEN', ports });
}

/**
 * The ORIGIN to use once listening on `port`. Only a plain http ORIGIN whose explicit port is one of `ports` (the
 * address of an earlier pick) follows the opened port; an https ORIGIN, one without a port (Caddy, a domain) or on
 * a port outside the list is the group's own choice and stays as it is.
 * @param {string | undefined} origin
 * @param {number[]} ports
 * @param {number} port
 * @returns {string | undefined}
 */
export function originFor(origin, ports, port) {
	if (!origin) return origin;
	let u;
	try {
		u = new URL(origin);
	} catch {
		return origin;
	}
	if (u.protocol !== 'http:' || !u.port) return origin;
	const was = Number(u.port);
	if (was === port || !ports.includes(was)) return origin;
	u.port = String(port);
	return u.origin;
}
