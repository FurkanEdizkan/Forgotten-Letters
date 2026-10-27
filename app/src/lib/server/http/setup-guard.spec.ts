import { describe, expect, it } from 'vitest';
import { setupGuard } from './setup-guard';

describe('setupGuard while setup is open', () => {
	const open = (path: string, method = 'GET') => setupGuard(path, method, true);

	it('sends every other page to /welcome', () => {
		for (const path of ['/', '/login', '/owner', '/home', '/invite/abc', '/account/password'])
			expect(open(path)).toEqual({ redirect: '/welcome' });
		expect(open('/owner', 'HEAD')).toEqual({ redirect: '/welcome' });
	});
	it('lets the wizard, help, health, the API description and files through', () => {
		for (const path of [
			'/welcome',
			'/setup',
			'/help/faq',
			'/health/ready',
			'/_app/immutable/x.js',
			'/favicon.svg',
			'/api/v1/setup',
			'/api/v1/openapi.json'
		])
			expect(open(path)).toBeNull();
		expect(open('/setup', 'POST')).toBeNull();
	});
	it('answers the rest of the API with a conflict', () => {
		expect(open('/api/v1/me')).toEqual({ apiConflict: true });
		expect(open('/api/v1/auth/login', 'POST')).toEqual({ apiConflict: true });
		expect(open('/api/v1/settings', 'PATCH')).toEqual({ apiConflict: true });
	});
	it('does not redirect form posts (they are not page loads)', () => {
		expect(open('/login', 'POST')).toBeNull();
	});
	it('does not mistake look-alike paths for open ones', () => {
		expect(open('/setupx')).toEqual({ redirect: '/welcome' });
		expect(open('/welcome-back')).toEqual({ redirect: '/welcome' });
	});
});

describe('setupGuard once setup is done', () => {
	const closed = (path: string, method = 'GET') => setupGuard(path, method, false);

	it('sends the welcome and setup pages to sign-in', () => {
		expect(closed('/welcome')).toEqual({ redirect: '/login' });
		expect(closed('/setup')).toEqual({ redirect: '/login' });
	});
	it('leaves everything else alone', () => {
		for (const path of ['/', '/login', '/owner', '/api/v1/me', '/api/v1/setup'])
			expect(closed(path)).toBeNull();
		expect(closed('/setup', 'POST')).toBeNull();
	});
});
