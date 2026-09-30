/** Pure rules for what the request log records; the database and Redis sides live in activity.ts. */

/**
 * The admin-log name of a non-GET request under /admin: the route (without `[params]`) plus the SvelteKit form
 * action, or the method for a default action or an API call. `/admin/games/[id]` + `?/start` → `admin.games.start`.
 */
export function adminActionName(routeId: string | null, search: string, method = 'POST'): string {
	if (!routeId) return `admin.unknown.${method.toLowerCase()}`;
	const route = routeId
		.split('/')
		.filter((seg) => seg && !seg.startsWith('[') && !seg.startsWith('('))
		.join('.');
	const action = search.match(/^\?\/([A-Za-z0-9_-]+)/)?.[1];
	return `${route}.${action ?? method.toLowerCase()}`;
}

/** A page the viewer opened: a document load, or SvelteKit's data fetch for a client-side navigation. */
export function isPageView(method: string, path: string, headers: { accept?: string | null }): boolean {
	if (method !== 'GET') return false;
	if (/^\/(_app|uploads|api)(\/|$)/.test(path) || path === '/health' || path === '/favicon.ico') return false;
	return path.endsWith('/__data.json') || !!headers.accept?.includes('text/html');
}

export interface ActivityRow {
	userId: string;
	/** UTC calendar day, YYYY-MM-DD. */
	day: string;
	requests: number;
	pageViews: number;
	firstSeenAt: Date;
	lastSeenAt: Date;
	lastIp: string | null;
}

/** Counts requests per user and day in memory until the next flush, so the database takes one upsert per row. */
export class ActivityBuffer {
	private rows = new Map<string, ActivityRow>();

	hit(userId: string, { at, ip, pageView }: { at: Date; ip: string | null; pageView: boolean }) {
		const day = at.toISOString().slice(0, 10);
		const key = `${userId}|${day}`;
		const row = this.rows.get(key);
		if (!row) {
			this.rows.set(key, { userId, day, requests: 1, pageViews: pageView ? 1 : 0, firstSeenAt: at, lastSeenAt: at, lastIp: ip });
			return;
		}
		row.requests++;
		if (pageView) row.pageViews++;
		if (at < row.firstSeenAt) row.firstSeenAt = at;
		if (at >= row.lastSeenAt) {
			row.lastSeenAt = at;
			row.lastIp = ip ?? row.lastIp;
		}
	}

	/** Everything counted since the last drain, emptied. */
	drain(): ActivityRow[] {
		const out = [...this.rows.values()];
		this.rows.clear();
		return out;
	}
}

/** "Firefox on Linux" from a user agent, for the device list; the raw string (trimmed) when it isn't a browser. */
export function deviceLabel(ua: string | null): string {
	if (!ua) return 'Unknown device';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /OPR\/|Opera/.test(ua)
			? 'Opera'
			: /Firefox\//.test(ua)
				? 'Firefox'
				: /Chrome\/|CriOS\//.test(ua)
					? 'Chrome'
					: /Safari\//.test(ua)
						? 'Safari'
						: null;
	const system = /iPhone/.test(ua)
		? 'iPhone'
		: /iPad/.test(ua)
			? 'iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Windows/.test(ua)
					? 'Windows'
					: /Mac OS X|Macintosh/.test(ua)
						? 'macOS'
						: /Linux|X11/.test(ua)
							? 'Linux'
							: null;
	if (!browser) return ua.slice(0, 60);
	return system ? `${browser} on ${system}` : browser;
}
