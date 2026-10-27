/**
 * Where a request goes while setup is open (no owner yet) and after. Pure, so the hook stays thin and the paths are
 * unit-tested. While open, pages lead to /welcome and the API answers 409, except what the wizard itself needs
 * (the setup endpoint, the API description), help pages, health checks and static files. Once closed, the welcome
 * and setup pages lead to sign-in.
 */

export type GuardResult = { redirect: string } | { apiConflict: true } | null;

const isPage = (method: string) => method === 'GET' || method === 'HEAD';
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Files such as /favicon.svg or /robots.txt: a dot in the last segment. */
const isFile = (path: string) => /\.[^/]+$/.test(path);

const SETUP_PAGES = ['/welcome', '/setup'];
const OPEN_PAGES = [...SETUP_PAGES, '/help', '/health', '/api', '/_app'];
const OPEN_API = ['/api/v1/setup', '/api/v1/openapi.json'];

export function setupGuard(path: string, method: string, setupOpen: boolean): GuardResult {
	if (setupOpen) {
		if (under(path, '/api/v1')) return OPEN_API.includes(path) ? null : { apiConflict: true };
		if (!isPage(method) || isFile(path) || OPEN_PAGES.some((p) => under(path, p))) return null;
		return { redirect: '/welcome' };
	}
	if (isPage(method) && SETUP_PAGES.some((p) => under(path, p))) return { redirect: '/login' };
	return null;
}
