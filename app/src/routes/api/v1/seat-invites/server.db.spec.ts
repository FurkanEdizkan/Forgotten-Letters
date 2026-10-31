import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '#lib/server/http';
import * as seats from '#lib/server/services/seats';
import { newCampaign, person, uniqueName, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import * as preview from './[token]/+server';
import * as accept from './[token]/accept/+server';

useTestDatabase();

type Handler = (event: RequestEvent) => Promise<Response>;
const at =
	(h: Handler, params: Record<string, string>): Handler =>
	(e) =>
		h({ ...e, params } as RequestEvent);

async function link() {
	const cm = await person('admin');
	const { campaign, seats: made } = await newCampaign(cm);
	const l = await seats.makeLink(cm.ctx(), campaign.id, made[0]!.id);
	return { cm, campaign, token: l.url.split('/join/')[1]! };
}

const account = () => ({
	username: uniqueName('p'),
	displayName: 'Vey',
	password: 'mud and brass 77'
});

describe('GET /api/v1/seat-invites/:token', () => {
	it('shows the link to anyone; 400 bad token; 404 unknown', async () => {
		const { campaign, token } = await link();
		expect(await call(at(preview.GET, { token }))).toMatchObject({
			status: 200,
			body: { state: 'open', seatName: 'Seat 1', campaign: { id: campaign.id } }
		});
		expect((await call(at(preview.GET, { token: '' }))).status).toBe(400);
		expect((await call(at(preview.GET, { token: 'nope' }))).body.error.code).toBe('not_found');
	});
});

describe('POST /api/v1/seat-invites/:token/accept', () => {
	it('a visitor makes an account: 201 { campaignId } and a session cookie', async () => {
		const { campaign, token } = await link();
		const res = await call(at(accept.POST, { token }), { method: 'POST', body: account() });
		expect(res).toMatchObject({ status: 201, body: { campaignId: campaign.id } });
		expect(res.cookies.get(SESSION_COOKIE)).toBeTruthy();
		const again = await call(at(accept.POST, { token }), { method: 'POST', body: account() });
		expect(again).toMatchObject({ status: 409, body: { error: { code: 'conflict' } } });
	});
	it('signed in takes the seat with {} and gets no new cookie', async () => {
		const { token } = await link();
		const p = await person('user');
		const res = await call(at(accept.POST, { token }), { method: 'POST', user: p.actor, body: {} });
		expect(res.status).toBe(201);
		expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
	});
	it('400 bad fields; 401 a visitor sending nothing; 404 a withdrawn link', async () => {
		const { cm, campaign, token } = await link();
		const bad = await call(at(accept.POST, { token }), {
			method: 'POST',
			body: { ...account(), username: 'No Spaces' }
		});
		expect(bad).toMatchObject({ status: 400, body: { error: { code: 'invalid' } } });
		const none = await call(at(accept.POST, { token }), { method: 'POST', body: {} });
		expect(none).toMatchObject({ status: 401, body: { error: { code: 'unauthenticated' } } });
		const seatId = (await seats.list(cm.ctx(), campaign.id))[0]!.id;
		await seats.revokeLink(cm.ctx(), campaign.id, seatId);
		const gone = await call(at(accept.POST, { token }), { method: 'POST', body: account() });
		expect(gone).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } });
	});
});
