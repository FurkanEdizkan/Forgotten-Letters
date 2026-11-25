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
				port: 5173,
				address: 'http://192.168.1.20:5173',
				portNote: null
			}
		});
	});
	it('after a fallback, gives the note and no portLocked', async () => {
		globalThis.__forgottenLettersListener = { port: 3001, wanted: 3000, tried: [3000] };
		const { actor } = await person('owner');
		const res = await call(GET, { user: actor, host: '192.168.1.20:3001' });
		expect(res.body).toMatchObject({
			port: 3001,
			address: 'http://192.168.1.20:3001',
			portNote: 'Port 3000 was in use, so the app uses 3001. Links now point to 3001.'
		});
		expect(res.body).not.toHaveProperty('portLocked');
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
	it('refuses bad or empty input (400)', async () => {
		const { actor } = await person('owner');
		for (const body of [{ textScale: 101 }, { accent: 'pink' }, {}]) {
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
	it('refuses a port field (400), with the reason on the field; nothing is saved', async () => {
		const { actor } = await person('owner');
		const res = await call(PATCH, {
			method: 'PATCH',
			user: actor,
			body: { accent: 'brass', port: 3001 }
		});
		expect(res.status).toBe(400);
		expect(res.body.error).toMatchObject({
			code: 'invalid',
			requestId: expect.any(String),
			fields: { port: 'The port is picked when the app starts. Set PORTS in .env instead.' }
		});
		const after = await call(GET, { user: actor });
		expect(after.body.accent).toBe('blood');
	});
});
