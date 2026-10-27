import { afterEach, describe, expect, it } from 'vitest';
import { person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import { GET, PATCH } from './+server';

useTestDatabase();

afterEach(() => {
	globalThis.__forgottenLettersListener = undefined;
});

describe('GET /api/v1/settings', () => {
	it('gives any signed-in account the settings', async () => {
		const { actor } = await person('user');
		const res = await call(GET, { user: actor, host: '192.168.1.20:5173' });
		expect(res).toMatchObject({
			status: 200,
			body: {
				textScale: 100,
				accent: 'blood',
				port: 3000,
				portLocked: true,
				address: 'http://192.168.1.20:5173'
			}
		});
	});
	it('asks to sign in first', async () => {
		const res = await call(GET);
		expect(res.status).toBe(401);
		expect(res.body.error.code).toBe('unauthenticated');
	});
});

describe('PATCH /api/v1/settings', () => {
	it('lets an owner change the look (200 with the settings)', async () => {
		const { actor } = await person('owner');
		const res = await call(PATCH, {
			method: 'PATCH',
			user: actor,
			body: { textScale: 125, accent: 'bruise' }
		});
		expect(res).toMatchObject({ status: 200, body: { textScale: 125, accent: 'bruise' } });
	});
	it('answers 202 with the new address when the port moves', async () => {
		const server = {
			port: 3000,
			async move(to: number) {
				server.port = to;
			}
		};
		globalThis.__forgottenLettersListener = server;
		const { actor } = await person('owner');
		const res = await call(PATCH, {
			method: 'PATCH',
			user: actor,
			host: '192.168.1.20:3000',
			body: { port: 4700 }
		});
		expect(res).toEqual({
			status: 202,
			body: { moveTo: 'http://192.168.1.20:4700' },
			cookies: expect.anything()
		});
	});
	it('refuses bad or empty input (400)', async () => {
		const { actor } = await person('owner');
		for (const body of [{ textScale: 101 }, { accent: 'pink' }, { port: 99999 }, {}]) {
			const res = await call(PATCH, { method: 'PATCH', user: actor, body });
			expect(res.status).toBe(400);
			expect(res.body.error.code).toBe('invalid');
		}
	});
	it('refuses anyone but an owner (403)', async () => {
		const { actor } = await person('admin');
		const res = await call(PATCH, { method: 'PATCH', user: actor, body: { accent: 'ash' } });
		expect(res.status).toBe(403);
		expect(res.body.error).toMatchObject({ code: 'forbidden', requestId: expect.any(String) });
	});
	it('refuses a port change while the port is locked (409)', async () => {
		const { actor } = await person('owner');
		const res = await call(PATCH, { method: 'PATCH', user: actor, body: { port: 4800 } });
		expect(res.status).toBe(409);
		expect(res.body.error.message).toContain('APP_PORT');
	});
});
