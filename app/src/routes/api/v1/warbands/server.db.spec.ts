/**
 * The warband API on real PostgreSQL with the invented rules folders: each endpoint's success, a validation error
 * and a permission error (someone else's warband is not found; the campaign's CM may read, never change).
 */
import type { RequestEvent } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openApiDocument } from '#lib/server/http/openapi';
import { newCampaign, person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import { RULES_FIXTURE } from '#lib/server/testing/rules';
import { loadAll } from '#lib/server/services/rules';
import * as seatsService from '#lib/server/services/seats';
import { warbandList, warbandOut } from '#lib/schemas/warbands';
import type { SessionUser } from '#lib/server/services/audit';
import * as list from './+server';
import * as choices from './choices/+server';
import * as imp from './import/+server';
import * as one from './[id]/+server';
import * as exp from './[id]/export/+server';
import * as recruits from './[id]/recruits/+server';
import * as fighters from './[id]/fighters/+server';
import * as fighter from './[id]/fighters/[fid]/+server';
import * as kit from './[id]/fighters/[fid]/kit/+server';
import * as upgrades from './[id]/fighters/[fid]/upgrades/+server';
import * as image from './[id]/fighters/[fid]/image/+server';
import * as stash from './[id]/stash/+server';
import * as give from './[id]/stash/give/+server';
import * as fireteams from './[id]/fireteams/+server';
import * as locations from './[id]/locations/+server';
import * as copyWarband from './[id]/copy/+server';
import * as switchRules from './[id]/rules/+server';
import * as move from './[id]/kit/move/+server';
import * as copyFighter from './[id]/fighters/[fid]/copy/+server';
import * as seat from '../campaigns/[id]/seats/mine/warband/+server';
import * as seated from '../campaigns/[id]/warbands/+server';
import * as campaignRoute from '../campaigns/[id]/+server';
import * as uploads from '../../../uploads/fighters/[id]/+server';

process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => loadAll(null, RULES_FIXTURE));

type Handler = (event: RequestEvent) => Promise<Response>;
const at =
	(h: Handler, params: Record<string, string>, query = ''): Handler =>
	(e) =>
		h({ ...e, params, url: new URL(`http://localhost:3000/api/v1${query}`) } as RequestEvent);

const expectError = (
	res: { status: number; body: { error: { code: string } } },
	status: number,
	code: string
) => {
	expect(res.status).toBe(status);
	expect(res.body.error).toMatchObject({ code, requestId: expect.any(String) });
};

const LG = 'faction:lantern-guild';
const TORCH = 'unit:lantern-guild/torchbearer';
const RIFLE = 'line:lantern-guild/hook-rifle';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);

/** A player with a warband of one Torchbearer, a stranger, and a CM whose campaign seats the player. */
async function world() {
	const me = await person('user');
	const stranger = await person('user');
	const made = await call(list.POST, {
		method: 'POST',
		user: me.actor,
		body: { name: 'Lamp Wardens', factionId: LG }
	});
	const id = warbandOut.parse(made.body).id;
	const r = await call(at(fighters.POST, { id }), {
		method: 'POST',
		user: me.actor,
		body: { unitId: TORCH }
	});
	const fid = r.body.fighters[0].id as string;
	return { me, stranger, id, fid, version: r.body.version as number };
}

/** A raw PUT, as a browser's fetch with a file body would send it. */
async function put(
	h: Handler,
	params: Record<string, string>,
	user: SessionUser,
	bytes: Uint8Array
) {
	const request = new Request('http://localhost:3000/api/v1', {
		method: 'PUT',
		headers: {
			host: 'localhost:3000',
			origin: 'http://localhost:3000',
			'content-type': 'image/png'
		},
		body: new Blob([bytes as Uint8Array<ArrayBuffer>])
	});
	const event = {
		request,
		url: new URL(request.url),
		params,
		locals: { requestId: randomUUID(), user },
		getClientAddress: () => '10.9.9.9'
	} as unknown as RequestEvent;
	const res = await h(event);
	return { status: res.status, body: await res.json() };
}

describe('PUT /warbands/{id}/rules', () => {
	it('switches the rules for its owner; refuses bad rules, others, stale versions', async () => {
		const { me, stranger, id, version } = await world();
		const ok = await call(at(switchRules.PUT, { id }), {
			method: 'PUT',
			user: me.actor,
			body: { version, rules: 'core-1.0.2+mire-preview-1.0' }
		});
		expect(ok.status).toBe(200);
		expect(warbandOut.parse(ok.body)).toMatchObject({
			rulesSet: 'core-1.0.2',
			rulesExpansions: ['mire-preview-1.0'],
			rules: { text: '1.0.2 (Preview)', preview: true }
		});
		expectError(
			await call(at(switchRules.PUT, { id }), {
				method: 'PUT',
				user: me.actor,
				body: { version: ok.body.version, rules: 'Not A Set' }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(switchRules.PUT, { id }), {
				method: 'PUT',
				user: stranger.actor,
				body: { version: ok.body.version, rules: 'core-1.0.1' }
			}),
			404,
			'not_found'
		);
		expectError(
			await call(at(switchRules.PUT, { id }), {
				method: 'PUT',
				user: me.actor,
				body: { version, rules: 'core-1.0.1' }
			}),
			409,
			'conflict'
		);
	});
});

describe('warbands', () => {
	it('GET, POST /warbands and GET /warbands/choices', async () => {
		const { me, id } = await world();
		const res = await call(list.GET, { user: me.actor });
		expect(warbandList.parse(res.body).items).toMatchObject([{ id, fighters: 1 }]);
		const c = await call(at(choices.GET, {}, '?rules=core-1.0.1'), { user: me.actor });
		expect(c.body).toMatchObject({ picked: 'core-1.0.1', factions: [{ id: LG }] });
		expectError(await call(list.GET), 401, 'unauthenticated');
		expectError(
			await call(list.POST, { method: 'POST', user: me.actor, body: { name: '', factionId: LG } }),
			400,
			'invalid'
		);
		expectError(
			await call(list.POST, {
				method: 'POST',
				user: me.actor,
				body: { name: 'X', factionId: LG, rulesSet: 'core-9.9' }
			}),
			404,
			'not_found'
		);
	});
	it('GET, PATCH, DELETE /warbands/:id', async () => {
		const { me, stranger, id, version } = await world();
		const got = await call(at(one.GET, { id }), { user: me.actor });
		expect(got.status).toBe(200);
		expect(warbandOut.parse(got.body).rating).toEqual({ ducats: 30, glory: 0 });
		expectError(await call(at(one.GET, { id }), { user: stranger.actor }), 404, 'not_found');
		const renamed = await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: me.actor,
			body: { version, name: 'Ash Lamps', notes: 'Met at the ford.' }
		});
		expect(renamed.body).toMatchObject({ name: 'Ash Lamps', notes: 'Met at the ford.' });
		expectError(
			await call(at(one.PATCH, { id }), { method: 'PATCH', user: me.actor, body: { version } }),
			409,
			'conflict'
		);
		expectError(
			await call(at(one.PATCH, { id }), {
				method: 'PATCH',
				user: me.actor,
				body: { version: renamed.body.version, ducatLimit: -1 }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(one.DELETE, { id }), { method: 'DELETE', user: stranger.actor }),
			404,
			'not_found'
		);
		expect((await call(at(one.DELETE, { id }), { method: 'DELETE', user: me.actor })).status).toBe(
			204
		);
	});
	it('GET /warbands/:id/export and POST /warbands/import', async () => {
		const { me, stranger, id } = await world();
		const ex = await call(at(exp.GET, { id }, '?format=json'), { user: me.actor });
		expect(ex.body).toMatchObject({ app: 'forgotten-letters-warband' });
		const text = await exp.GET({
			params: { id },
			url: new URL('http://localhost:3000/api/v1?format=text'),
			request: new Request('http://localhost:3000/api/v1'),
			locals: { requestId: 'r', user: me.actor },
			getClientAddress: () => '10.1.1.1'
		} as unknown as RequestEvent);
		expect(text.headers.get('content-disposition')).toBe('attachment; filename="Lamp Wardens.txt"');
		const body = await text.text();
		expect(body).toMatch(
			/^## Lamp Wardens ##\nFaction: Lantern Guild\nRating: 30 Ducats \| 0 Glory\n/
		);
		expectError(await call(at(exp.GET, { id }, '?format=pdf'), { user: me.actor }), 400, 'invalid');
		expectError(await call(at(exp.GET, { id }), { user: stranger.actor }), 404, 'not_found');
		const back = await call(imp.POST, { method: 'POST', user: me.actor, body: { text: body } });
		expect(back).toMatchObject({
			status: 201,
			body: { unmatched: [], warband: { fighters: [{}] } }
		});
		expectError(await call(imp.POST, { method: 'POST', user: me.actor, body: {} }), 400, 'invalid');
		expectError(
			await call(imp.POST, { method: 'POST', body: { text: body } }),
			401,
			'unauthenticated'
		);
	});
});

describe('fighters', () => {
	it('recruits, edits and removes fighters', async () => {
		const { me, stranger, id, fid } = await world();
		const r = await call(at(recruits.GET, { id }), { user: me.actor });
		expect(r.body.items.find((u: { unitId: string }) => u.unitId === TORCH)).toMatchObject({
			ok: true,
			cost: 30
		});
		expectError(
			await call(at(fighters.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { unitId: 'unit:lantern-guild/warden' }
			}).then(async () =>
				call(at(fighters.POST, { id }), {
					method: 'POST',
					user: me.actor,
					body: { unitId: 'unit:lantern-guild/warden' }
				})
			),
			409,
			'conflict'
		);
		expectError(
			await call(at(fighters.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { unitId: 'x' }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(fighters.POST, { id }), {
				method: 'POST',
				user: stranger.actor,
				body: { unitId: TORCH }
			}),
			404,
			'not_found'
		);
		const w = (await call(at(one.GET, { id }), { user: me.actor })).body;
		const v = w.fighters.find((x: { id: string }) => x.id === fid).version;
		const edited = await call(at(fighter.PATCH, { id, fid }), {
			method: 'PATCH',
			user: me.actor,
			body: { version: v, name: 'Pell', xp: 3, skills: ['Vigil'] }
		});
		expect(edited.body.fighters.find((x: { id: string }) => x.id === fid)).toMatchObject({
			name: 'Pell',
			xp: 3,
			skills: [{ ref: 'skill:the-keeper/vigil', name: 'Vigil' }]
		});
		expectError(
			await call(at(fighter.PATCH, { id, fid }), {
				method: 'PATCH',
				user: me.actor,
				body: { version: 1, group: 'hero' }
			}),
			400,
			'invalid'
		);
		const gone = await call(at(fighter.DELETE, { id, fid }), { method: 'DELETE', user: me.actor });
		expect(gone.status).toBe(200);
		expectError(
			await call(at(fighter.DELETE, { id, fid }), { method: 'DELETE', user: me.actor }),
			404,
			'not_found'
		);
	});
	it('kit and upgrades', async () => {
		const { me, stranger, id, fid } = await world();
		const lines = await call(at(kit.GET, { id, fid }), { user: me.actor });
		expect(lines.body.items.find((l: { lineId: string }) => l.lineId === RIFLE)).toMatchObject({
			ok: true,
			price: 10
		});
		const bought = await call(at(kit.POST, { id, fid }), {
			method: 'POST',
			user: me.actor,
			body: { lineId: RIFLE }
		});
		expect(bought.body.stashDucats).toBe(660);
		expectError(
			await call(at(kit.POST, { id, fid }), {
				method: 'POST',
				user: me.actor,
				body: { lineId: 'item:x' }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(kit.POST, { id, fid }), {
				method: 'POST',
				user: stranger.actor,
				body: { lineId: RIFLE }
			}),
			404,
			'not_found'
		);
		const sold = await call(at(kit.DELETE, { id, fid }, `?line=${RIFLE}`), {
			method: 'DELETE',
			user: me.actor
		});
		// The default is to sell: half the Hook Rifle's 10 Ducats back.
		expect(sold.body.stashDucats).toBe(665);
		expectError(
			await call(at(kit.DELETE, { id, fid }), { method: 'DELETE', user: me.actor }),
			400,
			'invalid'
		);
		const ups = await call(at(upgrades.GET, { id, fid }), { user: me.actor });
		expect(ups.body.items).toEqual([]);
		expectError(
			await call(at(upgrades.GET, { id, fid }), { user: stranger.actor }),
			404,
			'not_found'
		);
		// The Veteran upgrade is for the Warden only.
		expectError(
			await call(at(upgrades.POST, { id, fid }), {
				method: 'POST',
				user: me.actor,
				body: { upgradeId: 'upgrade:lantern-guild/veteran' }
			}),
			409,
			'conflict'
		);
		expectError(
			await call(at(upgrades.POST, { id, fid }), { method: 'POST', user: me.actor, body: {} }),
			400,
			'invalid'
		);
		expectError(
			await call(at(upgrades.DELETE, { id, fid }, '?upgrade=upgrade:lantern-guild/veteran'), {
				method: 'DELETE',
				user: me.actor
			}),
			404,
			'not_found'
		);
	});
	it('PUT, DELETE an image; GET /uploads/fighters/:id', async () => {
		const { me, stranger, id, fid } = await world();
		const ok = await put(image.PUT, { id, fid }, me.actor, PNG);
		expect(ok.status).toBe(200);
		const served = await uploads.GET({
			params: { id: fid },
			locals: { requestId: 'r', user: me.actor },
			request: new Request('http://localhost:3000/'),
			getClientAddress: () => '10.1.1.1'
		} as unknown as RequestEvent);
		expect(served.headers.get('content-type')).toBe('image/png');
		expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
		await expect(
			uploads.GET({
				params: { id: fid },
				locals: { requestId: 'r', user: stranger.actor },
				request: new Request('http://localhost:3000/'),
				getClientAddress: () => '10.1.1.1'
			} as unknown as RequestEvent)
		).rejects.toMatchObject({ status: 404 });
		expectError(
			await put(image.PUT, { id, fid }, me.actor, new TextEncoder().encode('GIF89a')),
			400,
			'invalid'
		);
		expectError(await put(image.PUT, { id, fid }, stranger.actor, PNG), 404, 'not_found');
		const cleared = await call(at(image.DELETE, { id, fid }), { method: 'DELETE', user: me.actor });
		expect(cleared.body.fighters[0].image).toBeNull();
		expectError(
			await call(at(image.DELETE, { id, fid: 'nope' }), { method: 'DELETE', user: me.actor }),
			400,
			'invalid'
		);
	});
});

describe('stash, fireteams, locations', () => {
	it('buys, sells and gives stash kit', async () => {
		const { me, stranger, id, fid } = await world();
		const offer = await call(at(stash.GET, { id }), { user: me.actor });
		expect(offer.body.items.find((l: { lineId: string }) => l.lineId === RIFLE)).toMatchObject({
			ok: true
		});
		expectError(await call(at(stash.GET, { id }), { user: stranger.actor }), 404, 'not_found');
		const b = await call(at(stash.POST, { id }), {
			method: 'POST',
			user: me.actor,
			body: { lineId: RIFLE }
		});
		expect(b.body.stash).toMatchObject([{ lineId: RIFLE }]);
		expectError(
			await call(at(stash.POST, { id }), { method: 'POST', user: me.actor, body: {} }),
			400,
			'invalid'
		);
		expectError(
			await call(at(stash.POST, { id }), {
				method: 'POST',
				user: stranger.actor,
				body: { lineId: RIFLE }
			}),
			404,
			'not_found'
		);
		const g = await call(at(give.POST, { id }), {
			method: 'POST',
			user: me.actor,
			body: { lineId: RIFLE, fighterId: fid }
		});
		expect(g.body.stash).toEqual([]);
		expectError(
			await call(at(give.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { lineId: RIFLE, fighterId: fid }
			}),
			404,
			'not_found'
		);
		expectError(
			await call(at(give.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { lineId: RIFLE }
			}),
			400,
			'invalid'
		);
		await call(at(stash.POST, { id }), { method: 'POST', user: me.actor, body: { lineId: RIFLE } });
		const s = await call(at(stash.DELETE, { id }, `?line=${RIFLE}`), {
			method: 'DELETE',
			user: me.actor
		});
		expect(s.body.stash).toEqual([]);
		expectError(
			await call(at(stash.DELETE, { id }, `?line=${RIFLE}`), { method: 'DELETE', user: me.actor }),
			404,
			'not_found'
		);
	});
	it('replaces fireteams and locations', async () => {
		const { me, stranger, id, fid } = await world();
		const two = await call(at(fighters.POST, { id }), {
			method: 'POST',
			user: me.actor,
			body: { unitId: TORCH }
		});
		const other = two.body.fighters[1].id;
		const f = await call(at(fireteams.PUT, { id }), {
			method: 'PUT',
			user: me.actor,
			body: { fireteams: [[fid, other]] }
		});
		expect(f.body.fireteams).toEqual([[fid, other]]);
		expectError(
			await call(at(fireteams.PUT, { id }), {
				method: 'PUT',
				user: me.actor,
				body: { fireteams: [[fid]] }
			}),
			400,
			'invalid'
		);
		const l = await call(at(locations.PUT, { id }), {
			method: 'PUT',
			user: me.actor,
			body: { locations: [{ name: 'Toll Bridge', note: 'Held' }] }
		});
		expect(l.body.locations).toEqual([{ name: 'Toll Bridge', note: 'Held' }]);
		expectError(
			await call(at(locations.PUT, { id }), {
				method: 'PUT',
				user: me.actor,
				body: { locations: [{ name: '' }] }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(locations.PUT, { id }), {
				method: 'PUT',
				user: stranger.actor,
				body: { locations: [] }
			}),
			404,
			'not_found'
		);
	});
});

describe('a seat’s warband', () => {
	it('PUT, DELETE /campaigns/:id/seats/mine/warband and GET /campaigns/:id/warbands', async () => {
		const { me, stranger, id } = await world();
		const cm = await person('admin');
		const { campaign, seats } = await newCampaign(cm, { kind: 'generic' });
		await seatsService.assign(cm.ctx(), campaign.id, seats[0]!.id, me.row.id);
		const cid = campaign.id;
		const put = await call(at(seat.PUT, { id: cid }), {
			method: 'PUT',
			user: me.actor,
			body: { warbandId: id }
		});
		expect(put.body.seat).toMatchObject({ campaignId: cid });
		expectError(
			await call(at(seat.PUT, { id: cid }), {
				method: 'PUT',
				user: me.actor,
				body: { warbandId: 'x' }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(seat.PUT, { id: cid }), {
				method: 'PUT',
				user: stranger.actor,
				body: { warbandId: id }
			}),
			404,
			'not_found'
		);
		// While it sits there, the campaign cannot move to another rules version.
		const camp = (await call(at(campaignRoute.GET, { id: cid }), { user: cm.actor })).body.campaign;
		expectError(
			await call(at(campaignRoute.PATCH, { id: cid }), {
				method: 'PATCH',
				user: cm.actor,
				body: {
					name: camp.name,
					visibility: camp.visibility,
					version: camp.version,
					rulesSet: 'core-1.0.1'
				}
			}),
			409,
			'conflict'
		);
		const list = await call(at(seated.GET, { id: cid }), { user: cm.actor });
		expect(list.body.items).toMatchObject([{ seatId: seats[0]!.id, warband: { id } }]);
		// The CM reads the warband, never changes it.
		expect((await call(at(one.GET, { id }), { user: cm.actor })).body.canEdit).toBe(false);
		expectError(
			await call(at(fighters.POST, { id }), {
				method: 'POST',
				user: cm.actor,
				body: { unitId: TORCH }
			}),
			403,
			'forbidden'
		);
		expectError(await call(at(seated.GET, { id: cid }), { user: me.actor }), 403, 'forbidden');
		expect(
			(await call(at(seat.DELETE, { id: cid }), { method: 'DELETE', user: me.actor })).status
		).toBe(204);
		expectError(
			await call(at(seat.DELETE, { id: cid }), { method: 'DELETE', user: stranger.actor }),
			404,
			'not_found'
		);
	});
});

describe('every warband endpoint', () => {
	it('400 on a bad id, 404 for someone else, 401 signed out', async () => {
		const { me, stranger, id, fid } = await world();
		const bad = { id: 'nope', fid: 'nope' };
		const mine = { id, fid };
		const cases: [Handler, string, unknown?][] = [
			[one.GET, 'GET'],
			[one.PATCH, 'PATCH', { version: 1 }],
			[one.DELETE, 'DELETE'],
			[exp.GET, 'GET'],
			[recruits.GET, 'GET'],
			[fighters.POST, 'POST', { unitId: TORCH }],
			[fighter.PATCH, 'PATCH', { version: 1, name: 'X' }],
			[fighter.DELETE, 'DELETE'],
			[kit.GET, 'GET'],
			[kit.POST, 'POST', { lineId: RIFLE }],
			[upgrades.GET, 'GET'],
			[upgrades.POST, 'POST', { upgradeId: 'upgrade:lantern-guild/veteran' }],
			[image.DELETE, 'DELETE'],
			[stash.GET, 'GET'],
			[stash.POST, 'POST', { lineId: RIFLE }],
			[give.POST, 'POST', { lineId: RIFLE, fighterId: fid }],
			[fireteams.PUT, 'PUT', { fireteams: [] }],
			[locations.PUT, 'PUT', { locations: [] }]
		];
		for (const [h, method, body] of cases) {
			expectError(await call(at(h, bad), { method, user: me.actor, body }), 400, 'invalid');
			expectError(
				await call(at(h, mine), { method, user: stranger.actor, body }),
				404,
				'not_found'
			);
			expectError(await call(at(h, mine), { method, body }), 401, 'unauthenticated');
		}
		// Sell and take off name what they remove in the query.
		expectError(
			await call(at(kit.DELETE, mine, `?line=${RIFLE}`), {
				method: 'DELETE',
				user: stranger.actor
			}),
			404,
			'not_found'
		);
		expectError(
			await call(at(upgrades.DELETE, mine, '?upgrade=upgrade:x'), {
				method: 'DELETE',
				user: stranger.actor
			}),
			404,
			'not_found'
		);
		expectError(
			await call(at(seat.DELETE, { id: 'nope' }), { method: 'DELETE', user: me.actor }),
			400,
			'invalid'
		);
		expectError(await call(at(seated.GET, { id: 'nope' }), { user: me.actor }), 400, 'invalid');
		expectError(
			await call(at(choices.GET, {}, '?rules=' + 'x'.repeat(201)), { user: me.actor }),
			400,
			'invalid'
		);
		expectError(await call(choices.GET), 401, 'unauthenticated');
	});
	it('POST /fighters with upgrades: refused without the Glory, taken with it', async () => {
		const { me, id, version } = await world();
		const body = {
			unitId: 'unit:lantern-guild/warden',
			upgrades: ['upgrade:lantern-guild/veteran']
		};
		expectError(
			await call(at(fighters.POST, { id }), { method: 'POST', user: me.actor, body }),
			409,
			'conflict'
		);
		expectError(
			await call(at(fighters.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { ...body, kit: ['item:cudgel'] }
			}),
			400,
			'invalid'
		);
		await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: me.actor,
			body: { version, unspentGlory: 1 }
		});
		const made = await call(at(fighters.POST, { id }), { method: 'POST', user: me.actor, body });
		expect(made).toMatchObject({ status: 201, body: { unspentGlory: 0, rating: { glory: 1 } } });
	});
	it('POST and DELETE an upgrade: paid in Glory, refunded on taking it off', async () => {
		const { me, id } = await world();
		const w = (
			await call(at(fighters.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { unitId: 'unit:lantern-guild/warden' }
			})
		).body;
		const warden = w.fighters.find((x: { unitId: string }) => x.unitId.endsWith('/warden')).id;
		await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: me.actor,
			body: { version: w.version, unspentGlory: 2 }
		});
		const on = await call(at(upgrades.POST, { id, fid: warden }), {
			method: 'POST',
			user: me.actor,
			body: { upgradeId: 'upgrade:lantern-guild/veteran' }
		});
		expect(on).toMatchObject({ status: 200, body: { unspentGlory: 1, rating: { glory: 1 } } });
		const off = await call(
			at(upgrades.DELETE, { id, fid: warden }, '?upgrade=upgrade:lantern-guild/veteran'),
			{ method: 'DELETE', user: me.actor }
		);
		expect(off).toMatchObject({ status: 200, body: { unspentGlory: 2, rating: { glory: 0 } } });
	});
});

describe('revision 2 endpoints', () => {
	it('DELETE kit and stash with a mode: sell half after the first game, refund refused', async () => {
		const { me, stranger, id, fid } = await world();
		let r = await call(at(kit.POST, { id, fid }), {
			method: 'POST',
			user: me.actor,
			body: { lineId: RIFLE }
		});
		const v = r.body.version as number;
		r = await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: me.actor,
			body: { version: v, gamesPlayed: 1 }
		});
		expect(r.body).toMatchObject({ gamesPlayed: 1, canRefund: false });
		const bank = r.body.stashDucats as number;
		expectError(
			await call(at(kit.DELETE, { id, fid }, `?line=${RIFLE}&mode=refund`), {
				method: 'DELETE',
				user: me.actor
			}),
			409,
			'conflict'
		);
		expectError(
			await call(at(kit.DELETE, { id, fid }, `?line=${RIFLE}&mode=give`), {
				method: 'DELETE',
				user: me.actor
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(kit.DELETE, { id, fid }, `?line=${RIFLE}`), {
				method: 'DELETE',
				user: stranger.actor
			}),
			404,
			'not_found'
		);
		r = await call(at(kit.DELETE, { id, fid }, `?line=${RIFLE}`), {
			method: 'DELETE',
			user: me.actor
		});
		expect(r.body.stashDucats).toBe(bank + 5);
		await call(at(stash.POST, { id }), { method: 'POST', user: me.actor, body: { lineId: RIFLE } });
		r = await call(at(stash.DELETE, { id }, `?line=${RIFLE}&mode=delete`), {
			method: 'DELETE',
			user: me.actor
		});
		expect(r.body.stash).toEqual([]);
	});
	it('POST /kit/move, /fighters/:fid/copy and /copy; DELETE a fighter with a mode', async () => {
		const { me, stranger, id, fid } = await world();
		await call(at(stash.POST, { id }), { method: 'POST', user: me.actor, body: { lineId: RIFLE } });
		let r = await call(at(move.POST, { id }), {
			method: 'POST',
			user: me.actor,
			body: { lineId: RIFLE, from: 'arsenal', to: fid }
		});
		expect(r.status).toBe(200);
		expect(r.body.stash).toEqual([]);
		expectError(
			await call(at(move.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { lineId: RIFLE, from: 'x', to: fid }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(move.POST, { id }), {
				method: 'POST',
				user: stranger.actor,
				body: { lineId: RIFLE, from: fid, to: 'arsenal' }
			}),
			404,
			'not_found'
		);
		r = await call(at(copyFighter.POST, { id, fid }), { method: 'POST', user: me.actor });
		expect(r.body.fighters).toHaveLength(2);
		expectError(
			await call(at(copyFighter.POST, { id, fid: 'nope' }), { method: 'POST', user: me.actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(copyFighter.POST, { id, fid }), { method: 'POST', user: stranger.actor }),
			404,
			'not_found'
		);
		const second = r.body.fighters[1].id as string;
		r = await call(at(fighter.DELETE, { id, fid: second }, '?mode=refund'), {
			method: 'DELETE',
			user: me.actor
		});
		expect(r.body.fighters).toHaveLength(1);
		expectError(
			await call(at(fighter.DELETE, { id, fid }, '?mode=sell'), {
				method: 'DELETE',
				user: me.actor
			}),
			400,
			'invalid'
		);
		r = await call(at(copyWarband.POST, { id }), {
			method: 'POST',
			user: me.actor,
			body: { name: 'Second Lamp' }
		});
		expect(r.body).toMatchObject({ name: 'Second Lamp', seat: null });
		expect(r.body.id).not.toBe(id);
		expectError(
			await call(at(copyWarband.POST, { id }), {
				method: 'POST',
				user: me.actor,
				body: { name: ''.padEnd(90, 'x') }
			}),
			400,
			'invalid'
		);
		expectError(
			await call(at(copyWarband.POST, { id }), { method: 'POST', user: stranger.actor, body: {} }),
			404,
			'not_found'
		);
	});
	it('PATCH /warbands/:id: campaign data; once played, the CM changes the Patron and nothing else', async () => {
		const { me, id } = await world();
		const cm = await person('admin');
		const { campaign, seats } = await newCampaign(cm, { kind: 'generic' });
		await seatsService.assign(cm.ctx(), campaign.id, seats[0]!.id, me.row.id);
		const put = await call(at(seat.PUT, { id: campaign.id }), {
			method: 'PUT',
			user: me.actor,
			body: { warbandId: id }
		});
		expect(put.status).toBe(200);
		let w = await call(at(one.GET, { id }), { user: me.actor });
		const played = await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: me.actor,
			body: { version: w.body.version, gamesPlayed: 1, victoryPoints: 3 }
		});
		expect(played.body).toMatchObject({ gamesPlayed: 1, victoryPoints: 3, canChangePatron: false });
		expectError(
			await call(at(one.PATCH, { id }), {
				method: 'PATCH',
				user: cm.actor,
				body: { version: played.body.version, name: 'Renamed' }
			}),
			403,
			'forbidden'
		);
		w = await call(at(one.GET, { id }), { user: cm.actor });
		expect(w.body.canChangePatron).toBe(true);
		const byCm = await call(at(one.PATCH, { id }), {
			method: 'PATCH',
			user: cm.actor,
			body: { version: w.body.version, patronId: null }
		});
		expect(byCm.status).toBe(200);
		expectError(
			await call(at(one.PATCH, { id }), {
				method: 'PATCH',
				user: me.actor,
				body: { version: byCm.body.version, gamesPlayed: 200 }
			}),
			400,
			'invalid'
		);
	});
	it('POST /warbands/import with format json; refuses JSON that is not a warband', async () => {
		const { me, id } = await world();
		const out = await call(at(exp.GET, { id }, '?format=json'), { user: me.actor });
		const text = typeof out.body === 'string' ? out.body : JSON.stringify(out.body);
		const r = await call(imp.POST, {
			method: 'POST',
			user: me.actor,
			body: { text, format: 'json', gamesPlayed: 2 }
		});
		expect(r.status).toBe(201);
		expect(r.body.warband).toMatchObject({ gamesPlayed: 2, canRefund: false });
		expectError(
			await call(imp.POST, {
				method: 'POST',
				user: me.actor,
				body: { text: '{"app":"elsewhere"}', format: 'json' }
			}),
			400,
			'invalid'
		);
	});
	it('PATCH a fighter’s status, scars and rank; refuses a bad status', async () => {
		const { me, id, fid } = await world();
		const w = await call(at(one.GET, { id }), { user: me.actor });
		const v = w.body.fighters[0].version as number;
		const r = await call(at(fighter.PATCH, { id, fid }), {
			method: 'PATCH',
			user: me.actor,
			body: { version: v, status: 'captured', scars: 1, group: 'elite' }
		});
		expect(r.body.fighters[0]).toMatchObject({ status: 'captured', scars: 1, group: 'elite' });
		expectError(
			await call(at(fighter.PATCH, { id, fid }), {
				method: 'PATCH',
				user: me.actor,
				body: { version: v + 1, status: 'lost' }
			}),
			400,
			'invalid'
		);
	});
});

describe('the OpenAPI document', () => {
	it('lists the warband paths', () => {
		const paths = Object.keys(openApiDocument().paths ?? {});
		for (const p of [
			'/warbands',
			'/warbands/{id}',
			'/warbands/{id}/fighters/{fid}/kit',
			'/warbands/{id}/fighters/{fid}/image',
			'/warbands/{id}/fighters/{fid}/copy',
			'/warbands/{id}/kit/move',
			'/warbands/{id}/copy',
			'/campaigns/{id}/seats/mine/warband',
			'/campaigns/{id}/warbands'
		])
			expect(paths).toContain(p);
	});
});
