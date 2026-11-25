import { describe, expect, it } from 'vitest';
import { openApiDocument } from '#lib/server/http/openapi';
import { PASSWORD, person, sql, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import * as transfer from './transfer/+server';

useTestDatabase();

const expectError = (
	res: { status: number; body: { error: { code: string; fields?: Record<string, string> } } },
	status: number,
	code: string
) => {
	expect(res.status).toBe(status);
	expect(res.body.error).toMatchObject({ code, requestId: expect.any(String) });
	return res.body.error;
};

describe('POST /owner/transfer (decision 80)', () => {
	it('hands ownership on: 200 with both people, the old Owner now an Admin', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const res = await call(transfer.POST, {
			method: 'POST',
			user: owner.actor,
			body: { to: admin.row.id, password: PASSWORD, version: admin.row.version }
		});
		expect(res).toMatchObject({
			status: 200,
			body: {
				from: { id: owner.row.id, role: 'admin', version: owner.row.version + 1 },
				to: { id: admin.row.id, role: 'owner', version: admin.row.version + 1 }
			}
		});
		expect(await sql()`select username from auth.users where role = 'owner'`).toEqual([
			{ username: admin.row.username }
		]);
	});
	it('400 for a wrong password (on the password field) or bad input; 403 for a non-Owner; 404 unknown; 409 yourself; 401 signed out', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const post = (body: unknown, user = owner.actor) =>
			call(transfer.POST, { method: 'POST', user, body });
		const wrong = expectError(
			await post({ to: admin.row.id, password: 'not my password', version: admin.row.version }),
			400,
			'invalid'
		);
		expect(wrong.fields).toEqual({ password: 'That is not your current password.' });
		expectError(await post({ to: 'nobody', password: PASSWORD, version: 1 }), 400, 'invalid');
		expectError(
			await post({ to: owner.row.id, password: PASSWORD, version: 1 }, admin.actor),
			403,
			'forbidden'
		);
		expectError(
			await post({ to: '01900000-0000-7000-8000-000000000000', password: PASSWORD, version: 1 }),
			404,
			'not_found'
		);
		expectError(
			await post({ to: owner.row.id, password: PASSWORD, version: owner.row.version }),
			409,
			'conflict'
		);
		expectError(
			await call(transfer.POST, {
				method: 'POST',
				body: { to: admin.row.id, password: PASSWORD, version: 1 }
			}),
			401,
			'unauthenticated'
		);
		expect(await sql()`select username from auth.users where role = 'owner'`).toEqual([
			{ username: owner.row.username }
		]);
	});
	it('is in the OpenAPI document', () => {
		expect(Object.keys(openApiDocument().paths ?? {})).toContain('/owner/transfer');
	});
});
