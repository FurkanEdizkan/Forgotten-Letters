/**
 * Where to go after sign-in: only a path on this site. Parsed the way a browser will parse the
 * Location header, so `/\evil.com` or a path hiding a tab (`/\t/evil.com`) can't slip through as `//evil.com`.
 */
export function safeNext(next: string | null, origin: string): string | null {
	if (!next || !next.startsWith('/')) return null;
	let u: URL;
	try {
		u = new URL(next, origin);
	} catch {
		return null;
	}
	return u.origin === origin ? u.pathname + u.search + u.hash : null;
}
