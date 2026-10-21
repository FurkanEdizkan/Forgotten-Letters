import { describe, expect, it } from 'vitest';
import { db } from '../db';
import { ctx, person, useTestDatabase } from '../testing/db';
import { list, record } from './audit';
import { create } from './invites';

useTestDatabase();

describe('the audit log (F17)', () => {
	it('records the actor, target, address and request id of an action', async () => {
		const owner = await person('owner', { displayName: 'The Owner' });
		const c = owner.ctx();
		const { invite } = await create(c, { role: 'user' });
		const { items } = await list(owner.ctx(), { limit: 10, action: 'invite.created' });
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			actorName: 'The Owner',
			actorId: owner.row.id,
			targetType: 'invite',
			targetId: invite.id,
			ip: c.ip,
			requestId: c.requestId,
			detail: { role: 'user' }
		});
	});
	it('records actions without an actor', async () => {
		const owner = await person('owner');
		const c = ctx();
		await record(db(), c, 'sign_in.failed', null, { username: 'ghost' });
		const { items } = await list(owner.ctx(), { limit: 10 });
		expect(items[0]).toMatchObject({
			action: 'sign_in.failed',
			actorId: null,
			actorName: null,
			targetId: null,
			requestId: c.requestId
		});
	});
	it('pages newest first, filtered by action', async () => {
		const owner = await person('owner');
		const c = ctx();
		for (const action of ['sign_in', 'sign_out', 'sign_in', 'sign_in'] as const)
			await record(db(), c, action);
		const first = await list(owner.ctx(), { limit: 2, action: 'sign_in' });
		expect(first.items.map((e) => e.id)).toEqual([4, 3]);
		expect(first.next).toBe(3);
		const rest = await list(owner.ctx(), { limit: 2, action: 'sign_in', before: first.next! });
		expect(rest.items.map((e) => e.id)).toEqual([1]);
		expect(rest.next).toBeNull();
	});
	it('only an owner may read it', async () => {
		const admin = await person('admin');
		const user = await person('user');
		await expect(list(admin.ctx(), { limit: 10 })).rejects.toMatchObject({ code: 'forbidden' });
		await expect(list(user.ctx(), { limit: 10 })).rejects.toMatchObject({ code: 'forbidden' });
		await expect(list(ctx(), { limit: 10 })).rejects.toMatchObject({ code: 'forbidden' });
	});
});
