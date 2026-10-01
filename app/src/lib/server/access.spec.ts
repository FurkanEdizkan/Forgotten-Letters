import { describe, expect, it } from 'vitest';
import { accessFor, accessMode, landingFor, type AccessUser } from './access';

const cm: AccessUser = { role: 'cm', mustChangePassword: false };
const player: AccessUser = { role: 'player', mustChangePassword: false };
const temporary: AccessUser = { role: 'player', mustChangePassword: true };
const get = (path: string, search = '') => ({ path, search, method: 'GET' });
const post = (path: string) => ({ path, method: 'POST' });

describe('access modes', () => {
	it('reads ACCESS: private only when it says so', () => {
		expect(accessMode('private')).toBe('private');
		expect(accessMode(' Private ')).toBe('private');
		expect(accessMode(undefined)).toBe('open');
		expect(accessMode('anything')).toBe('open');
	});

	it('open: a signed-out visitor watches the campaign but not the admin', () => {
		for (const p of ['/', '/players', '/zones/A', '/compendium', '/history', '/api/stream', '/uploads/x.webp', '/warbands/w1'])
			expect(accessFor('open', get(p), null)).toEqual({ allow: true });
		expect(accessFor('open', get('/admin/games', '?x=1'), null)).toEqual({ redirect: '/admin/login?next=%2Fadmin%2Fgames%3Fx%3D1' });
		for (const mode of ['open', 'private'] as const) {
			expect(accessFor(mode, get('/admin/login'), null)).toEqual({ allow: true });
			expect(accessFor(mode, post('/admin/login'), null)).toEqual({ allow: true });
		}
		expect(accessFor('open', post('/admin'), null)).toMatchObject({ status: 401 });
	});

	it('private: signed out, only the door is open', () => {
		for (const p of ['/login', '/logout', '/join/abc', '/health', '/_app/immutable/x.js', '/favicon.ico'])
			expect(accessFor('private', get(p), null)).toEqual({ allow: true });
		expect(accessFor('private', get('/'), null)).toEqual({ redirect: '/login?next=%2F' });
		expect(accessFor('private', get('/players'), null)).toEqual({ redirect: '/login?next=%2Fplayers' });
		for (const p of ['/api/stream', '/api/round', '/uploads/c/x.webp', '/api/battle-result/g1']) expect(accessFor('private', get(p), null)).toMatchObject({ status: 401 });
		expect(accessFor('private', post('/warbands/w1'), null)).toMatchObject({ status: 401 });
		expect(accessFor('private', post('/login'), null)).toEqual({ allow: true });
	});

	it('private: signed in, the campaign is open as on a LAN', () => {
		for (const p of ['/', '/players', '/api/stream', '/uploads/x.webp']) expect(accessFor('private', get(p), player)).toEqual({ allow: true });
	});

	it('the admin: only the Campaign Master, and a player gets a 403 (no redirect loop)', () => {
		for (const mode of ['open', 'private'] as const) {
			expect(accessFor(mode, get('/admin'), cm)).toEqual({ allow: true });
			expect(accessFor(mode, get('/admin'), player)).toMatchObject({ status: 403 });
			expect(accessFor(mode, get('/settings/admin'), player)).toMatchObject({ status: 403 });
		}
	});

	it('a temporary password: only Settings (and sign-out) until it is replaced', () => {
		for (const mode of ['open', 'private'] as const) {
			expect(accessFor(mode, get('/players'), temporary)).toEqual({ redirect: '/settings?first=1' });
			expect(accessFor(mode, get('/admin'), { role: 'cm', mustChangePassword: true })).toEqual({ redirect: '/settings?first=1' });
			expect(accessFor(mode, get('/api/round'), temporary)).toMatchObject({ status: 403 });
			for (const p of ['/settings', '/logout', '/login', '/api/stream', '/uploads/x.webp']) expect(accessFor(mode, get(p), temporary)).toEqual({ allow: true });
		}
	});

	it('after signing in: next when it may be opened, else home', () => {
		expect(landingFor('open', cm, null)).toBe('/admin');
		expect(landingFor('open', player, null)).toBe('/');
		expect(landingFor('open', player, '/warbands/w1')).toBe('/warbands/w1');
		expect(landingFor('open', player, '/admin/games')).toBe('/');
		expect(landingFor('private', cm, '/admin/games?x=1')).toBe('/admin/games?x=1');
		expect(landingFor('open', temporary, '/players')).toBe('/settings?first=1');
	});
});
