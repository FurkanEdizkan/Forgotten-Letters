// Production entry. adapter-node assumes https unless told otherwise, which breaks
// form CSRF checks and cookies on a plain-http LAN. A TLS proxy in front (e.g. Caddy)
// sets x-forwarded-proto itself; direct LAN requests default to http.
import http from 'node:http';
import { handler } from './build/handler.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

http
	.createServer((req, res) => {
		req.headers['x-forwarded-proto'] ??= 'http';
		handler(req, res);
	})
	.listen(port, host, () => console.log(`Listening on http://${host}:${port}`));
