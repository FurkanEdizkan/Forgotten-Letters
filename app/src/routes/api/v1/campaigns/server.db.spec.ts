import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { openApiDocument } from '#lib/server/http/openapi';
import { newCampaign, person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import * as requestsService from '#lib/server/services/join-requests';
import { addCoCm } from '#lib/server/services/campaigns';
import * as list from './+server';
import * as one from './[id]/+server';
import * as restore from './[id]/restore/+server';
import * as stage from './[id]/stage/+server';
import * as seatsRoute from './[id]/seats/+server';
import * as seat from './[id]/seats/[seatId]/+server';
import * as invite from './[id]/seats/[seatId]/invite/+server';
import * as assign from './[id]/seats/[seatId]/assign/+server';
import * as mine from './[id]/seats/mine/+server';
import * as links from './[id]/seat-links/+server';
import * as candidates from './[id]/candidates/+server';
import * as coCms from './[id]/co-cms/+server';
import * as coCm from './[id]/co-cms/[userId]/+server';
import * as transfer from './[id]/transfer/+server';
import * as requests from './[id]/requests/+server';
import * as myRequest from './[id]/requests/mine/+server';
import * as approve from './[id]/requests/[rid]/approve/+server';
import * as decline from './[id]/requests/[rid]/decline/+server';
import * as presets from '../house-rule-presets/+server';

useTestDatabase();

type Handler = (event: RequestEvent) => Promise<Response>;

/** The handler with path params and a query string set, since `call` sends neither. */
const at =
	(h: Handler, params: Record<string, string>, query = ''): Handler =>
	(e) =>
		h({ ...e, params, url: new URL(`http://localhost:3000/api/v1${query}`) } as RequestEvent);

async function world() {
	const cm = await person('admin');
	const user = await person('user', { displayName: 'Vey' });
	const { campaign, seats } = await newCampaign(cm);
	return { cm, user, campaign, seats, id: campaign.id, seatId: seats[0]!.id };
}

const expectError = (
	res: { status: number; body: { error: { code: string } } },
	status: number,
	code: string
) => {
	expect(res.status).toBe(status);
	expect(res.body.error).toMatchObject({ code, requestId: expect.any(String) });
};

describe('GET, POST /campaigns', () => {
	it('lists and creates', async () => {
		const { cm, id } = await world();
		const res = await call(at(list.GET, {}, '?scope=mine'), { user: cm.actor });
		expect(res).toMatchObject({ status: 200, body: { items: [{ id }], next: null } });
		const made = await call(list.POST, {
			method: 'POST',
			user: cm.actor,
			body: { name: 'Ash Road', kind: 'generic', visibility: 'private', seats: 2 }
		});
		expect(made).toMatchObject({
			status: 201,
			body: { campaign: { name: 'Ash Road' }, seats: [{}, {}] }
		});
	});
	it('400 on bad input, 401 signed out, 403 for Users, 409 name taken', async () => {
		const { cm, user, campaign } = await world();
		expectError(await call(at(list.GET, {}, '?scope=nope'), { user: cm.actor }), 400, 'invalid');
		expectError(await call(list.GET), 401, 'unauthenticated');
		const body = { name: 'X', kind: 'generic', visibility: 'listed', seats: 31 };
		expectError(await call(list.POST, { method: 'POST', user: cm.actor, body }), 400, 'invalid');
		expectError(
			await call(list.POST, { method: 'POST', user: user.actor, body: { ...body, seats: 2 } }),
			403,
			'forbidden'
		);
		const taken = await call(list.POST, {
			method: 'POST',
			user: cm.actor,
			body: { ...body, seats: 2, name: campaign.name }
		});
		expectError(taken, 409, 'conflict');
	});
});

describe('GET, PATCH, DELETE /campaigns/:id and restore', () => {
	it('reads with an ETag, saves, deletes and restores', async () => {
		const { cm, campaign, id } = await world();
		const got = await call(at(one.GET, { id }), { user: cm.actor });
		expect(got).toMatchObject({
			status: 200,
			body: { campaign: { id }, myRole: 'cm', seatsTaken: 0 }
		});
		const saved = await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: cm.actor,
			body: { name: campaign.name, visibility: 'listed', description: 'Mud.', version: 1 }
		});
		expect(saved).toMatchObject({ status: 200, body: { description: 'Mud.', version: 2 } });
		expect((await call(at(one.DELETE, { id }), { method: 'DELETE', user: cm.actor })).status).toBe(
			204
		);
		const back = await call(at(restore.POST, { id }), { method: 'POST', user: cm.actor });
		expect(back).toMatchObject({ status: 200, body: { id, deletedAt: null } });
	});
	it('400, 404 and 403 as they should', async () => {
		const { cm, user, campaign, id } = await world();
		expectError(await call(at(one.GET, { id: 'nope' }), { user: cm.actor }), 400, 'invalid');
		const priv = (await newCampaign(cm, { visibility: 'private' })).campaign;
		expectError(await call(at(one.GET, { id: priv.id }), { user: user.actor }), 404, 'not_found');
		const body = { name: campaign.name, visibility: 'listed', version: 1 };
		expectError(
			await call(at(one.PATCH, { id }), {
				method: 'PATCH',
				user: cm.actor,
				body: { ...body, version: 0 }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(one.PATCH, { id }), { method: 'PATCH', user: user.actor, body }),
			403,
			'forbidden'
		);
		expectError(
			await call(at(one.PATCH, { id }), {
				method: 'PATCH',
				user: cm.actor,
				body: { ...body, version: 9 }
			}),
			409,
			'conflict'
		);
		expectError(
			await call(at(one.DELETE, { id: 'x' }), { method: 'DELETE', user: cm.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(one.DELETE, { id }), { method: 'DELETE', user: user.actor }),
			403,
			'forbidden'
		);
		expectError(
			await call(at(restore.POST, { id: 'x' }), { method: 'POST', user: cm.actor }),
			400,
			'invalid'
		);
		await call(at(one.DELETE, { id }), { method: 'DELETE', user: cm.actor });
		const admin = await person('admin');
		expectError(
			await call(at(restore.POST, { id }), { method: 'POST', user: admin.actor }),
			404,
			'not_found'
		);
		const co = await person('admin');
		const other = (await newCampaign(cm)).campaign;
		await addCoCm(cm.ctx(), other.id, co.row.id);
		await call(at(one.DELETE, { id: other.id }), { method: 'DELETE', user: cm.actor });
		// A co-CM cannot see a deleted campaign at all, so cannot restore it either.
		expectError(
			await call(at(restore.POST, { id: other.id }), { method: 'POST', user: co.actor }),
			404,
			'not_found'
		);
	});
});

describe('POST /campaigns/:id/stage', () => {
	it('moves; 400 bad stage; 403 players; 409 not allowed', async () => {
		const { cm, user, id } = await world();
		const ok = await call(at(stage.POST, { id }), {
			method: 'POST',
			user: cm.actor,
			body: { to: 'active' }
		});
		expect(ok).toMatchObject({ status: 200, body: { stage: 'active' } });
		expectError(
			await call(at(stage.POST, { id }), { method: 'POST', user: cm.actor, body: { to: 'x' } }),
			400,
			'invalid'
		);
		expectError(
			await call(at(stage.POST, { id }), {
				method: 'POST',
				user: user.actor,
				body: { to: 'ended' }
			}),
			403,
			'forbidden'
		);
		await call(at(stage.POST, { id }), { method: 'POST', user: cm.actor, body: { to: 'ended' } });
		expectError(
			await call(at(stage.POST, { id }), {
				method: 'POST',
				user: cm.actor,
				body: { to: 'active' }
			}),
			409,
			'conflict'
		);
	});
});

describe('seats', () => {
	it('GET and POST /campaigns/:id/seats', async () => {
		const { cm, user, id } = await world();
		expect(await call(at(seatsRoute.GET, { id }), { user: user.actor })).toMatchObject({
			status: 200,
			body: { items: [{ name: 'Seat 1' }, {}, {}] }
		});
		expectError(await call(at(seatsRoute.GET, { id: 'x' }), { user: user.actor }), 400, 'invalid');
		expectError(await call(at(seatsRoute.GET, { id })), 401, 'unauthenticated');
		const added = await call(at(seatsRoute.POST, { id }), {
			method: 'POST',
			user: cm.actor,
			body: { count: 2 }
		});
		expect(added).toMatchObject({
			status: 201,
			body: { items: [{ name: 'Seat 4' }, { name: 'Seat 5' }] }
		});
		expectError(
			await call(at(seatsRoute.POST, { id }), {
				method: 'POST',
				user: cm.actor,
				body: { count: 0 }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(seatsRoute.POST, { id }), {
				method: 'POST',
				user: user.actor,
				body: { count: 1 }
			}),
			403,
			'forbidden'
		);
		expectError(
			await call(at(seatsRoute.POST, { id }), {
				method: 'POST',
				user: cm.actor,
				body: { count: 26 }
			}),
			409,
			'conflict'
		);
	});
	it('PATCH and DELETE /campaigns/:id/seats/:seatId', async () => {
		const { cm, user, id, seats } = await world();
		const seatId = seats[0]!.id;
		const renamed = await call(at(seat.PATCH, { id, seatId }), {
			method: 'PATCH',
			user: cm.actor,
			body: { version: 1, name: 'Vanguard' }
		});
		expect(renamed).toMatchObject({ status: 200, body: { name: 'Vanguard', version: 2 } });
		expectError(
			await call(at(seat.PATCH, { id, seatId }), {
				method: 'PATCH',
				user: cm.actor,
				body: { version: 2 }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(seat.PATCH, { id, seatId }), {
				method: 'PATCH',
				user: user.actor,
				body: { version: 2, name: 'x' }
			}),
			403,
			'forbidden'
		);
		expect(
			(await call(at(seat.DELETE, { id, seatId }), { method: 'DELETE', user: cm.actor })).status
		).toBe(204);
		expectError(
			await call(at(seat.DELETE, { id, seatId: 'x' }), { method: 'DELETE', user: cm.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(seat.DELETE, { id, seatId: seats[1]!.id }), {
				method: 'DELETE',
				user: user.actor
			}),
			403,
			'forbidden'
		);
	});
	it('POST, DELETE /seats/:seatId/invite and POST /seat-links', async () => {
		const { cm, user, id, seatId } = await world();
		const made = await call(at(invite.POST, { id, seatId }), { method: 'POST', user: cm.actor });
		expect(made).toMatchObject({
			status: 201,
			body: { seatId, url: expect.stringContaining('/join/') }
		});
		expectError(
			await call(at(invite.POST, { id, seatId: 'x' }), { method: 'POST', user: cm.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(invite.POST, { id, seatId }), { method: 'POST', user: user.actor }),
			403,
			'forbidden'
		);
		expect(
			(await call(at(invite.DELETE, { id, seatId }), { method: 'DELETE', user: cm.actor })).status
		).toBe(204);
		expectError(
			await call(at(invite.DELETE, { id: 'x', seatId }), { method: 'DELETE', user: cm.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(invite.DELETE, { id, seatId }), { method: 'DELETE', user: user.actor }),
			403,
			'forbidden'
		);
		const all = await call(at(links.POST, { id }), { method: 'POST', user: cm.actor });
		expect(all).toMatchObject({ status: 201, body: { links: [{}, {}, {}] } });
		expectError(
			await call(at(links.POST, { id: 'x' }), { method: 'POST', user: cm.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(links.POST, { id }), { method: 'POST', user: user.actor }),
			403,
			'forbidden'
		);
	});
	it('GET /seats/:seatId/invite copies the stored link; DELETE /seat-links withdraws them all', async () => {
		const { cm, user, id, seatId } = await world();
		const made = await call(at(invite.POST, { id, seatId }), { method: 'POST', user: cm.actor });
		const url = (made.body as { url: string }).url;
		expect(await call(at(invite.GET, { id, seatId }), { user: cm.actor })).toMatchObject({
			status: 200,
			body: { seatId, url, expiresAt: null, createdAt: expect.any(String) }
		});
		expectError(
			await call(at(invite.GET, { id, seatId: 'x' }), { user: cm.actor }),
			400,
			'invalid'
		);
		expectError(await call(at(invite.GET, { id, seatId }), { user: user.actor }), 403, 'forbidden');
		expectError(
			await call(at(links.DELETE, { id }), { method: 'DELETE', user: user.actor }),
			403,
			'forbidden'
		);
		expect(
			await call(at(links.DELETE, { id }), { method: 'DELETE', user: cm.actor })
		).toMatchObject({
			status: 200,
			body: { withdrawn: 1 }
		});
		expectError(
			await call(at(links.DELETE, { id: 'x' }), { method: 'DELETE', user: cm.actor }),
			400,
			'invalid'
		);
	});
	it('GET /house-rule-presets lists the library to anyone signed in', async () => {
		const { user } = await world();
		const r = await call(presets.GET, { user: user.actor });
		expect(r).toMatchObject({
			status: 200,
			body: {
				items: expect.arrayContaining([
					expect.objectContaining({ key: 'trench-depth', kind: 'configuration' })
				])
			}
		});
		expectError(await call(presets.GET, {}), 401, 'unauthenticated');
	});
	it('POST /seats/:seatId/assign, GET /candidates and DELETE /seats/mine', async () => {
		const { cm, user, id, seatId } = await world();
		const found = await call(at(candidates.GET, { id }, '?q=vey'), { user: cm.actor });
		expect(found).toMatchObject({ status: 200, body: { items: [{ id: user.row.id }] } });
		expectError(await call(at(candidates.GET, { id }, '?q='), { user: cm.actor }), 400, 'invalid');
		expectError(
			await call(at(candidates.GET, { id }, '?q=vey'), { user: user.actor }),
			403,
			'forbidden'
		);
		const co = await call(
			at(candidates.GET, { id }, `?q=${cm.row.username.slice(0, 5)}&for=co_cm`),
			{
				user: cm.actor
			}
		);
		expect(co.status).toBe(200);
		const s = await call(at(assign.POST, { id, seatId }), {
			method: 'POST',
			user: cm.actor,
			body: { userId: user.row.id }
		});
		expect(s).toMatchObject({ status: 200, body: { player: { id: user.row.id } } });
		expectError(
			await call(at(assign.POST, { id, seatId }), {
				method: 'POST',
				user: cm.actor,
				body: { userId: 'x' }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(assign.POST, { id, seatId }), {
				method: 'POST',
				user: user.actor,
				body: { userId: user.row.id }
			}),
			403,
			'forbidden'
		);
		expect(
			(await call(at(mine.DELETE, { id }), { method: 'DELETE', user: user.actor })).status
		).toBe(204);
		expectError(
			await call(at(mine.DELETE, { id: 'x' }), { method: 'DELETE', user: user.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(mine.DELETE, { id }), { method: 'DELETE', user: user.actor }),
			404,
			'not_found'
		);
	});
});

describe('co-CMs and transfer', () => {
	it('POST /co-cms, DELETE /co-cms/:userId, POST /transfer', async () => {
		const { cm, user, id } = await world();
		const admin = await person('admin');
		const added = await call(at(coCms.POST, { id }), {
			method: 'POST',
			user: cm.actor,
			body: { userId: admin.row.id }
		});
		expect(added).toMatchObject({
			status: 200,
			body: { members: [{ role: 'cm' }, { role: 'co_cm' }] }
		});
		expectError(
			await call(at(coCms.POST, { id }), { method: 'POST', user: cm.actor, body: {} }),
			400,
			'invalid'
		);
		expectError(
			await call(at(coCms.POST, { id }), {
				method: 'POST',
				user: admin.actor,
				body: { userId: user.row.id }
			}),
			403,
			'forbidden'
		);
		expectError(
			await call(at(coCms.POST, { id }), {
				method: 'POST',
				user: cm.actor,
				body: { userId: user.row.id }
			}),
			409,
			'conflict'
		);
		expectError(
			await call(at(transfer.POST, { id }), { method: 'POST', user: cm.actor, body: {} }),
			400,
			'invalid'
		);
		expectError(
			await call(at(transfer.POST, { id }), {
				method: 'POST',
				user: admin.actor,
				body: { userId: admin.row.id }
			}),
			403,
			'forbidden'
		);
		const moved = await call(at(transfer.POST, { id }), {
			method: 'POST',
			user: cm.actor,
			body: { userId: admin.row.id }
		});
		expect(moved).toMatchObject({
			status: 200,
			body: { members: [{ userId: admin.row.id, role: 'cm' }, {}] }
		});
		expectError(
			await call(at(coCm.DELETE, { id, userId: 'x' }), { method: 'DELETE', user: admin.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(coCm.DELETE, { id, userId: cm.row.id }), { method: 'DELETE', user: cm.actor }),
			403,
			'forbidden'
		);
		const removed = await call(at(coCm.DELETE, { id, userId: cm.row.id }), {
			method: 'DELETE',
			user: admin.actor
		});
		expect(removed).toMatchObject({ status: 200, body: { members: [{ userId: admin.row.id }] } });
	});
});

describe('join requests', () => {
	it('POST, GET /requests and DELETE /requests/mine', async () => {
		const { cm, user, id } = await world();
		const made = await call(at(requests.POST, { id }), {
			method: 'POST',
			user: user.actor,
			body: { note: 'Hi' }
		});
		expect(made).toMatchObject({ status: 201, body: { person: { id: user.row.id }, note: 'Hi' } });
		expectError(
			await call(at(requests.POST, { id }), {
				method: 'POST',
				user: user.actor,
				body: { note: 'x'.repeat(301) }
			}),
			400,
			'invalid'
		);
		const priv = (await newCampaign(cm, { visibility: 'private' })).campaign;
		expectError(
			await call(at(requests.POST, { id: priv.id }), {
				method: 'POST',
				user: user.actor,
				body: {}
			}),
			403,
			'forbidden'
		);
		expectError(
			await call(at(requests.POST, { id }), { method: 'POST', user: user.actor, body: {} }),
			409,
			'conflict'
		);
		expect(await call(at(requests.GET, { id }), { user: cm.actor })).toMatchObject({
			status: 200,
			body: { items: [{ id: made.body.id }] }
		});
		expectError(await call(at(requests.GET, { id: 'x' }), { user: cm.actor }), 400, 'invalid');
		expectError(await call(at(requests.GET, { id }), { user: user.actor }), 403, 'forbidden');
		expect(
			(await call(at(myRequest.DELETE, { id }), { method: 'DELETE', user: user.actor })).status
		).toBe(204);
		expectError(
			await call(at(myRequest.DELETE, { id: 'x' }), { method: 'DELETE', user: user.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(myRequest.DELETE, { id }), { method: 'DELETE', user: user.actor }),
			404,
			'not_found'
		);
	});
	it('POST /requests/:rid/approve and /decline', async () => {
		const { cm, user, id, seatId } = await world();
		const other = await person('user');
		const r1 = await requestsService.request(user.ctx(), id, '');
		const r2 = await requestsService.request(other.ctx(), id, '');
		expectError(
			await call(at(approve.POST, { id, rid: r1.id }), {
				method: 'POST',
				user: cm.actor,
				body: {}
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(approve.POST, { id, rid: r1.id }), {
				method: 'POST',
				user: other.actor,
				body: { seatId }
			}),
			403,
			'forbidden'
		);
		const ok = await call(at(approve.POST, { id, rid: r1.id }), {
			method: 'POST',
			user: cm.actor,
			body: { seatId }
		});
		expect(ok).toMatchObject({ status: 200, body: { id: seatId, player: { id: user.row.id } } });
		expectError(
			await call(at(approve.POST, { id, rid: r2.id }), {
				method: 'POST',
				user: cm.actor,
				body: { seatId }
			}),
			409,
			'conflict'
		);
		expectError(
			await call(at(decline.POST, { id, rid: 'x' }), { method: 'POST', user: cm.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(decline.POST, { id, rid: r2.id }), { method: 'POST', user: other.actor }),
			403,
			'forbidden'
		);
		expect(
			(await call(at(decline.POST, { id, rid: r2.id }), { method: 'POST', user: cm.actor })).status
		).toBe(204);
		expectError(
			await call(at(decline.POST, { id, rid: r2.id }), { method: 'POST', user: cm.actor }),
			409,
			'conflict'
		);
	});
});

describe('the OpenAPI document', () => {
	it('lists every campaign and seat-link path', () => {
		const paths = Object.keys(openApiDocument().paths ?? {});
		for (const p of [
			'/campaigns',
			'/campaigns/{id}',
			'/campaigns/{id}/seats/{seatId}/invite',
			'/campaigns/{id}/requests/{rid}/approve',
			'/seat-invites/{token}/accept',
			'/campaigns/{id}/seat-links',
			'/house-rule-presets'
		])
			expect(paths).toContain(p);
	});
});
