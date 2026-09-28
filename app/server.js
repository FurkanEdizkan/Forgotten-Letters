// Production entry. adapter-node assumes https unless told otherwise, which breaks
// form CSRF checks and cookies on a plain-http LAN. A TLS proxy in front (e.g. Caddy)
// sets x-forwarded-proto itself; direct LAN requests default to http.
import http from 'node:http';
import { handler } from './build/handler.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const server = http
	.createServer((req, res) => {
		req.headers['x-forwarded-proto'] ??= 'http';
		handler(req, res);
	})
	.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));

// Stop cleanly on `docker compose down`: finish requests in flight, cut the live-map streams
// (they never end on their own), then let the app close its database pool.
let stopping = false;
function shutdown(signal) {
	if (stopping) return;
	stopping = true;
	console.log(`${signal}: shutting down`);
	server.close(() => {
		process.emit('sveltekit:shutdown', signal);
		setTimeout(() => process.exit(0), 500).unref();
	});
	server.closeIdleConnections();
	setTimeout(() => server.closeAllConnections(), 2000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
