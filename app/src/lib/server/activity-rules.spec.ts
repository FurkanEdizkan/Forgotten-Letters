import { describe, expect, it } from 'vitest';
import { ActivityBuffer, adminActionName, deviceLabel, isPageView } from './activity-rules';

describe('adminActionName', () => {
	it('names a form action by its route and action', () => {
		expect(adminActionName('/admin/games/[id]', '?/start')).toBe('admin.games.start');
		expect(adminActionName('/admin/players', '?/resolveReset&x=1')).toBe('admin.players.resolveReset');
	});
	it('names a default action and an API call by method', () => {
		expect(adminActionName('/admin', '', 'POST')).toBe('admin.post');
		expect(adminActionName('/admin/api/battles/[id]', '', 'PATCH')).toBe('admin.api.battles.patch');
	});
	it('names an unknown route by nothing more than its method', () => {
		expect(adminActionName(null, '', 'POST')).toBe('admin.unknown.post');
	});
});

describe('isPageView', () => {
	const html = { accept: 'text/html,application/xhtml+xml' };
	it('counts a document load and a client-side navigation', () => {
		expect(isPageView('GET', '/zones/holy-choked-path', html)).toBe(true);
		expect(isPageView('GET', '/zones/holy-choked-path/__data.json', {})).toBe(true);
	});
	it('does not count assets, uploads, the live stream, APIs or form posts', () => {
		for (const path of ['/_app/immutable/x.js', '/uploads/a.webp', '/api/stream', '/health', '/favicon.ico'])
			expect(isPageView('GET', path, html), path).toBe(false);
		expect(isPageView('POST', '/login', html)).toBe(false);
	});
});

describe('ActivityBuffer', () => {
	it('adds up requests and page views per user and day, keeping the first and last sighting', () => {
		const b = new ActivityBuffer();
		b.hit('u1', { at: new Date('2026-09-30T10:00:00Z'), ip: '10.0.0.1', pageView: true });
		b.hit('u1', { at: new Date('2026-09-30T11:00:00Z'), ip: '10.0.0.2', pageView: false });
		b.hit('u1', { at: new Date('2026-10-01T00:30:00Z'), ip: '10.0.0.2', pageView: true });
		b.hit('u2', { at: new Date('2026-09-30T12:00:00Z'), ip: null, pageView: true });
		expect(b.drain()).toEqual([
			{ userId: 'u1', day: '2026-09-30', requests: 2, pageViews: 1, firstSeenAt: new Date('2026-09-30T10:00:00Z'), lastSeenAt: new Date('2026-09-30T11:00:00Z'), lastIp: '10.0.0.2' },
			{ userId: 'u1', day: '2026-10-01', requests: 1, pageViews: 1, firstSeenAt: new Date('2026-10-01T00:30:00Z'), lastSeenAt: new Date('2026-10-01T00:30:00Z'), lastIp: '10.0.0.2' },
			{ userId: 'u2', day: '2026-09-30', requests: 1, pageViews: 1, firstSeenAt: new Date('2026-09-30T12:00:00Z'), lastSeenAt: new Date('2026-09-30T12:00:00Z'), lastIp: null }
		]);
		expect(b.drain()).toEqual([]);
	});
});

describe('deviceLabel', () => {
	it('names the browser and system from a user agent', () => {
		expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe('Firefox on Linux');
		expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0')).toBe('Edge on Windows');
		expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1')).toBe('Safari on iPhone');
		expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36')).toBe('Chrome on Android');
	});
	it('falls back gracefully', () => {
		expect(deviceLabel(null)).toBe('Unknown device');
		expect(deviceLabel('curl/8.5.0')).toBe('curl/8.5.0');
	});
});
