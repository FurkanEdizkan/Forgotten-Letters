// The production entry point (`node server`), replacing adapter-node's own `build/index.js`. It picks the port at
// start: PORTS in order (default 3000 to 3005; see ports.js), moving past a taken one with a log line and exiting 1
// with one clear message when none is free. After a fallback a plain http ORIGIN on a listed port is pointed at the
// opened port before the app loads, so invite links and the cross-site check match. The port never changes while
// the app runs; the app reads it, read-only, from globalThis.__forgottenLettersListener (only
// src/lib/server/infra/listener.ts does). In Docker the image sets PORTS=3000 (always free inside the container)
// and the host's start script (start.sh, start.ps1) picks the published port instead.
//
// Settings: PORTS (or the legacy PORT, tried alone), HOST (default 0.0.0.0), SHUTDOWN_TIMEOUT (seconds, default
// 30), KEEP_ALIVE_TIMEOUT and HEADERS_TIMEOUT (seconds), as adapter-node reads them. Socket activation and
// SOCKET_PATH are not supported here; use `node build` for those.
import http from 'node:http';
import process from 'node:process';
import { originFor, parsePorts, pickPort } from './ports.js';

const host = process.env.HOST ?? '0.0.0.0';
const shutdownTimeout = Number.parseInt(process.env.SHUTDOWN_TIMEOUT ?? '30', 10);
const seconds = (name) => {
	const v = process.env[name];
	return v === undefined || v === '' ? undefined : Number.parseInt(v, 10) * 1000;
};

/** @type {null | ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void)} */
let handler = null;
let shuttingDown = false;
/** @type {http.Server | null} */
let server = null;

function onRequest(req, res) {
	// The port opens before the app has loaded (migrations may take a while); until then say so, as the app's own
	// readiness gate does.
	if (!handler) {
		res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '5' });
		res.end(
			JSON.stringify({
				error: {
					code: 'unavailable',
					message: 'The app is starting. Try again in a moment.',
					requestId: 'starting'
				}
			})
		);
		return;
	}
	// While shutting down, close each keep-alive connection as soon as its request is done.
	req.on('close', () => {
		if (shuttingDown) server?.closeIdleConnections();
	});
	handler(req, res, () => {
		res.statusCode = 404;
		res.end();
	});
}

function createServer() {
	const s = http.createServer(onRequest);
	const keepAlive = seconds('KEEP_ALIVE_TIMEOUT');
	const headers = seconds('HEADERS_TIMEOUT');
	if (keepAlive !== undefined) s.keepAliveTimeout = keepAlive;
	if (headers !== undefined) s.headersTimeout = headers;
	return s;
}

/** Listen on `p` with a fresh server; resolves once listening, rejects with the listen error (EADDRINUSE, EACCES). */
function listen(p) {
	const s = createServer();
	return new Promise((resolve, reject) => {
		const failed = (e) => {
			s.off('listening', done);
			reject(e);
		};
		const done = () => {
			s.off('error', failed);
			server = s;
			console.log(`Listening on http://${host}:${p}`);
			resolve();
		};
		s.once('error', failed);
		s.once('listening', done);
		s.listen({ host, port: p });
	});
}

function shutdown(reason) {
	if (shuttingDown) return;
	shuttingDown = true;
	if (!server) {
		process.emit('sveltekit:shutdown', reason);
		return;
	}
	// Requests in flight finish; stragglers are cut after the shutdown timeout.
	server.close(() => process.emit('sveltekit:shutdown', reason));
	server.closeIdleConnections();
	setTimeout(() => server?.closeAllConnections(), shutdownTimeout * 1000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

let ports;
let picked;
try {
	ports = parsePorts(process.env);
	picked = await pickPort(ports, listen, (message) => console.warn(message));
} catch (e) {
	// A bad list or every port taken: one message, no stack trace, nothing half-started.
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}

const origin = originFor(process.env.ORIGIN, ports, picked.port);
if (origin && origin !== process.env.ORIGIN) {
	console.log(`ORIGIN is ${process.env.ORIGIN}; using ${origin} for this run`);
	process.env.ORIGIN = origin;
}

globalThis.__forgottenLettersListener = Object.freeze({
	port: picked.port,
	wanted: picked.wanted,
	tried: Object.freeze([...picked.tried])
});
// Loaded last: adapter-node reads ORIGIN when the handler loads, and Kit's init hook runs while this import loads.
({ handler } = await import('../build/handler.js'));
