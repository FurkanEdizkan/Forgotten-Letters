/**
 * Who may reach what. One pure decision for every request, so the rules live in one place and are tested as a
 * whole (access.spec.ts); hooks.server.ts only carries it out.
 *
 * Two modes (ACCESS in .env):
 * - open (default, a LAN at the venue): anyone who can reach the app watches the map and reads the campaign;
 *   signing in adds what an account may do.
 * - private (deployed on the internet): signed out, only the door is open (sign in, ask for an account or a reset,
 *   follow a seat invite). Everything else, pages, the live stream, uploads and APIs, needs an account.
 */
export type AccessMode = 'open' | 'private';
export interface AccessUser {
	role: 'cm' | 'player';
	mustChangePassword: boolean;
}
export type Access = { allow: true } | { redirect: string } | { status: 401 | 403; message: string };

export const accessMode = (raw: string | undefined): AccessMode => (raw?.trim().toLowerCase() === 'private' ? 'private' : 'open');

const under = (path: string, base: string) => path === base || path.startsWith(base + '/');

/** Always reachable: the doors (players' and the Campaign Master's), sign-out, the health check, and the app's own scripts. */
const ADMIN_DOOR = '/admin/login';
const DOOR = ['/login', ADMIN_DOOR, '/logout', '/join', '/health'];
const isDoor = (path: string) => DOOR.some((p) => under(path, p)) || path.startsWith('/_app/') || path === '/favicon.ico' || path === '/robots.txt';

/** A temporary password must be replaced before anything else: these stay reachable meanwhile. */
const WHILE_TEMPORARY = ['/settings', '/logout', '/login', '/health', '/api/stream'];
const isWhileTemporary = (path: string) => WHILE_TEMPORARY.some((p) => under(path, p)) || path.startsWith('/_app/') || path.startsWith('/uploads/');

const isCmOnly = (path: string) => (under(path, '/admin') && !under(path, ADMIN_DOOR)) || under(path, '/settings/admin');
/** Data rather than pages: answered with a status, never a redirect to a page. */
const isData = (path: string) => under(path, '/api') || under(path, '/uploads');

const isRead = (method: string) => method === 'GET' || method === 'HEAD';
const toLogin = (path: string, search: string, door = '/login') => ({ redirect: `${door}?next=${encodeURIComponent(path + search)}` });

export function accessFor(mode: AccessMode, req: { path: string; search?: string; method: string }, user: AccessUser | null): Access {
	const { path, method } = req;
	const search = req.search ?? '';
	if (user?.mustChangePassword && !isWhileTemporary(path)) return isData(path) ? { status: 403, message: 'Choose your own password first.' } : { redirect: '/settings?first=1' };
	if (isCmOnly(path)) {
		// Signed out: the Campaign Master's own door, which only the CM can get through.
		if (!user) return isData(path) || !isRead(method) ? { status: 401, message: 'Sign in first.' } : toLogin(path, search, ADMIN_DOOR);
		if (user.role !== 'cm') return { status: 403, message: 'Only the Campaign Master can open this.' };
	}
	if (mode === 'private' && !user && !isDoor(path)) {
		if (isData(path) || !isRead(method)) return { status: 401, message: 'Sign in first.' };
		return toLogin(path, search);
	}
	return { allow: true };
}

/** Where a signed-in user goes from the login page: `next` when they may open it, else their home. */
export function landingFor(mode: AccessMode, user: AccessUser, next: string | null): string {
	if (user.mustChangePassword) return '/settings?first=1';
	if (next) {
		const [path, query] = next.split('?');
		if ('allow' in accessFor(mode, { path, search: query ? `?${query}` : '', method: 'GET' }, user)) return next;
	}
	return user.role === 'cm' ? '/admin' : '/';
}
