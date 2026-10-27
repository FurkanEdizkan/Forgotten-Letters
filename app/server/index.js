// The production entry point (`node server`), replacing adapter-node's own `build/index.js`. It owns the HTTP
// listeners so the port saved in settings can change while the app runs: the app asks, through the control on
// globalThis (read only by src/lib/server/infra/listener.ts), to listen on another port; the new port opens first,
// and the old one closes 10 seconds later, once the browser has had time to follow. In Docker the image sets
// PORT_LOCKED=1 and the control is never asked to move (Compose owns the published port).
//
// Settings: HOST (default 0.0.0.0), PORT (default 3000, the first-run port), SHUTDOWN_TIMEOUT (seconds, default
// 30), KEEP_ALIVE_TIMEOUT and HEADERS_TIMEOUT (seconds), as adapter-node reads them. Socket activation and
// SOCKET_PATH are not supported here; use `node build` for those (the port is then locked).
import http from 'node:http';
import process from 'node:process';

const HANDOVER_MS = 10_000;
const host = process.env.HOST ?? '0.0.0.0';
const shutdownTimeout = Number.parseInt(process.env.SHUTDOWN_TIMEOUT ?? '30', 10);
const seconds = (name) => {
	const v = process.env[name];
	return v === undefined || v === '' ? undefined : Number.parseInt(v, 10) * 1000;
};

/** @type {null | ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void)} */
let handler = null;
let port = Number(process.env.PORT ?? 3000);
let shuttingDown = false;
/** Every server still open: the current one and any that are handing over. */
const servers = new Set();

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
		if (shuttingDown) for (const s of servers) s.closeIdleConnections();
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

/** Listen on `p`; resolves once listening, rejects with the listen error (EADDRINUSE, EACCES). */
function listen(s, p) {
	return new Promise((resolve, reject) => {
		const failed = (e) => {
			s.off('listening', done);
			reject(e);
		};
		const done = () => {
			s.off('error', failed);
			servers.add(s);
			console.log(`Listening on http://${host}:${p}`);
			resolve();
		};
		s.once('error', failed);
		s.once('listening', done);
		s.listen({ host, port: p });
	});
}

/** Stop taking connections on `s`; requests in flight finish, stragglers are cut after the shutdown timeout. */
function retire(s, onClosed) {
	s.close(() => {
		servers.delete(s);
		onClosed?.();
	});
	s.closeIdleConnections();
	setTimeout(() => s.closeAllConnections(), shutdownTimeout * 1000).unref();
}

let current = createServer();

globalThis.__forgottenLettersListener = {
	get port() {
		return port;
	},
	async move(next) {
		if (next === port || shuttingDown) return;
		const fresh = createServer();
		await listen(fresh, next);
		const old = current;
		current = fresh;
		port = next;
		// The browser that asked is still talking to the old port: give it time to follow the new address.
		setTimeout(() => retire(old), HANDOVER_MS).unref();
	}
};

function shutdown(reason) {
	if (shuttingDown) return;
	shuttingDown = true;
	let open = servers.size;
	if (!open) process.emit('sveltekit:shutdown', reason);
	for (const s of [...servers])
		retire(s, () => {
			if (--open === 0) process.emit('sveltekit:shutdown', reason);
		});
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await listen(current, port);
// Imported after the control exists: Kit's init hook (run while this import loads) may already ask to move.
({ handler } = await import('../build/handler.js'));
