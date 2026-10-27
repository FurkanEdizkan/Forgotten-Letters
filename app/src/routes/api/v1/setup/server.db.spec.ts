import { describe, expect, it } from 'vitest';
import { person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import { SESSION_COOKIE } from '#lib/server/http';
import { GET, POST } from './+server';

useTestDatabase();

const input = {
	username: 'first.owner',
	password: 'a long owner password',
	displayName: 'First Owner',
	textScale: 105,
	accent: 'ash',
	port: 3000
};

describe('GET /api/v1/setup', () => {
	it('says whether setup is open', async () => {
		expect(await call(GET)).toMatchObject({ status: 200, body: { open: true } });
	});
});

describe('POST /api/v1/setup', () => {
	it('creates the owner, signs in and answers 201', async () => {
		const res = await call(POST, { method: 'POST', body: input });
		expect(res.status).toBe(201);
		expect(res.body).toEqual({
			user: {
				id: expect.any(String),
				username: 'first.owner',
				displayName: 'First Owner',
				role: 'owner',
				mustChangePassword: false
			},
			moveTo: null
		});
		expect(res.cookies.get(SESSION_COOKIE)).toEqual(expect.any(String));
		expect(await call(GET)).toMatchObject({ body: { open: false } });
	});
	it('refuses bad input with the field reasons', async () => {
		const res = await call(POST, {
			method: 'POST',
			body: { ...input, textScale: 133, accent: 'pink', port: 80 }
		});
		expect(res.status).toBe(400);
		expect(res.body.error).toMatchObject({
			code: 'invalid',
			requestId: expect.any(String),
			fields: {
				textScale: expect.any(String),
				accent: expect.any(String),
				port: expect.any(String)
			}
		});
	});
	it('refuses once setup is done (409)', async () => {
		await person('owner');
		const res = await call(POST, { method: 'POST', body: input });
		expect(res.status).toBe(409);
		expect(res.body.error).toMatchObject({
			code: 'conflict',
			message: 'Setup is already done. Sign in instead.'
		});
		expect(res.cookies.size).toBe(0);
	});
});
