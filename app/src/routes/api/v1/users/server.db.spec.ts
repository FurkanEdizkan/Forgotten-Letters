import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import * as one from './[id]/+server';

useTestDatabase();

type Handler = (event: RequestEvent) => Promise<Response>;

/** The handler with path params set, since `call` sends none. */
const at =
	(h: Handler, params: Record<string, string>): Handler =>
	(e) =>
		h({ ...e, params } as RequestEvent);

const expectError = (
	res: { status: number; body: { error: { code: string; fields?: Record<string, string> } } },
	status: number,
	code: string
) => {
	expect(res.status).toBe(status);
	expect(res.body.error).toMatchObject({ code, requestId: expect.any(String) });
	return res.body.error;
};

describe('PATCH /users/:id (decision 80)', () => {
	it('changes a role to Campaign Master (admin) or Player (user)', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const res = await call(at(one.PATCH, { id: user.row.id }), {
			method: 'PATCH',
			user: owner.actor,
			body: { role: 'admin', version: user.row.version }
		});
		expect(res).toMatchObject({ status: 200, body: { id: user.row.id, role: 'admin' } });
	});
	it('400 for the Owner role, 409 when the target is the Owner, 403 for an Admin, 401 signed out', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const asOwner = (id: string, body: unknown) =>
			call(at(one.PATCH, { id }), { method: 'PATCH', user: owner.actor, body });
		const err = expectError(
			await asOwner(admin.row.id, { role: 'owner', version: admin.row.version }),
			400,
			'invalid'
		);
		expect(err.fields?.role).toBeTruthy();
		const own = expectError(
			await asOwner(owner.row.id, { role: 'admin', version: owner.row.version }),
			409,
			'conflict'
		);
		expect(own).toMatchObject({ message: 'Ownership moves only by transfer.' });
		expect(
			expectError(
				await asOwner(owner.row.id, { disabled: true, version: owner.row.version }),
				409,
				'conflict'
			)
		).toMatchObject({ message: 'Transfer ownership first.' });
		expectError(
			await call(at(one.PATCH, { id: owner.row.id }), {
				method: 'PATCH',
				user: admin.actor,
				body: { role: 'user', version: 1 }
			}),
			403,
			'forbidden'
		);
		expectError(
			await call(at(one.PATCH, { id: admin.row.id }), {
				method: 'PATCH',
				body: { role: 'user', version: 1 }
			}),
			401,
			'unauthenticated'
		);
	});
});
