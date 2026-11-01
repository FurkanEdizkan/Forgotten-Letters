/**
 * The homebrew API on real PostgreSQL with the invented rules folders: each endpoint's success, a validation error
 * and a permission error (someone else's private set is not found; a shared one is read-only), plus the campaign
 * allow-list through the campaign PATCH.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { openApiDocument } from '#lib/server/http/openapi';
import { newCampaign, person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import { RULES_FIXTURE } from '#lib/server/testing/rules';
import { loadAll } from '#lib/server/services/rules';
import { homebrewList, homebrewOut } from '#lib/schemas/homebrew';
import * as list from './+server';
import * as one from './[id]/+server';
import * as share from './[id]/share/+server';
import * as exp from './[id]/export/+server';
import * as imp from './import/+server';
import * as campaignRoute from '../campaigns/[id]/+server';

process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => loadAll(null, RULES_FIXTURE));

type Handler = (event: RequestEvent) => Promise<Response>;
const at =
	(h: Handler, params: Record<string, string>): Handler =>
	(e) =>
		h({ ...e, params } as RequestEvent);
const expectError = (
	res: { status: number; body: { error: { code: string } } },
	status: number,
	code: string
) => {
	expect(res.status).toBe(status);
	expect(res.body.error).toMatchObject({ code, requestId: expect.any(String) });
};

const COPY = {
	name: 'Cinder Wardens',
	base: 'core-1.0.2',
	start: 'copy',
	of: 'variant:lantern-guild/ash-wardens'
};

async function world() {
	const me = await person('user');
	const stranger = await person('user');
	const made = await call(list.POST, { method: 'POST', user: me.actor, body: COPY });
	expect(made.status).toBe(201);
	const h = homebrewOut.parse(made.body);
	return { me, stranger, h };
}

describe('/api/v1/homebrew', () => {
	it('lists, creates and refuses bad input or an unknown base', async () => {
		const { me, stranger, h } = await world();
		const mine = await call(list.GET, { user: me.actor });
		expect(homebrewList.parse(mine.body).mine.map((c) => c.id)).toEqual([h.id]);
		expect((await call(list.GET, { user: stranger.actor })).body).toEqual({ mine: [], shared: [] });
		expectError(await call(list.GET, {}), 401, 'unauthenticated');
		const bad = await call(list.POST, {
			method: 'POST',
			user: me.actor,
			body: { ...COPY, start: 'variant', of: '' }
		});
		expectError(bad, 400, 'invalid');
		expect(bad.body.error.fields).toHaveProperty('of');
		const none = await call(list.POST, {
			method: 'POST',
			user: me.actor,
			body: { ...COPY, base: 'core-9.9' }
		});
		expectError(none, 404, 'not_found');
	});

	it('reads with an ETag; a stranger gets not_found until it is shared', async () => {
		const { me, stranger, h } = await world();
		const got = await call(at(one.GET, { id: h.id }), { user: me.actor });
		expect(got.status).toBe(200);
		expectError(await call(at(one.GET, { id: h.id }), { user: stranger.actor }), 404, 'not_found');
		expectError(await call(at(one.GET, { id: 'nope' }), { user: me.actor }), 400, 'invalid');
		const shared = await call(at(share.POST, { id: h.id }), { method: 'POST', user: me.actor });
		expect(shared.body.visibility).toBe('shared');
		expect((await call(at(one.GET, { id: h.id }), { user: stranger.actor })).status).toBe(200);
		expectError(
			await call(at(share.DELETE, { id: h.id }), { method: 'DELETE', user: stranger.actor }),
			403,
			'forbidden'
		);
		const back = await call(at(share.DELETE, { id: h.id }), { method: 'DELETE', user: me.actor });
		expect(back.body.visibility).toBe('private');
		expectError(
			await call(at(share.POST, { id: 'x' }), { method: 'POST', user: me.actor }),
			400,
			'invalid'
		);
	});

	it('saves the whole set with a version check; others may not', async () => {
		const { me, stranger, h } = await world();
		const body = { version: h.version, name: 'Cinder Wardens II', data: h.data };
		const saved = await call(at(one.PUT, { id: h.id }), { method: 'PUT', user: me.actor, body });
		expect(saved.body).toMatchObject({
			name: 'Cinder Wardens II',
			version: h.version + 1,
			ok: true,
			published: { version: h.version + 1, checkedAt: expect.any(String) }
		});
		// A draft with problems saves (200) with its report; players stay on the version that passed.
		const data = structuredClone(saved.body.data);
		data.variants[0].faction = 'faction:nowhere';
		const draft = await call(at(one.PUT, { id: h.id }), {
			method: 'PUT',
			user: me.actor,
			body: { version: saved.body.version, data }
		});
		expect(homebrewOut.parse(draft.body)).toMatchObject({
			ok: false,
			problems: 1,
			published: { version: saved.body.version }
		});
		const back = await call(at(one.PUT, { id: h.id }), {
			method: 'PUT',
			user: me.actor,
			body: { version: draft.body.version, data: saved.body.data }
		});
		expect(back.body).toMatchObject({ ok: true, published: { version: draft.body.version + 1 } });
		expectError(
			await call(at(one.PUT, { id: h.id }), { method: 'PUT', user: me.actor, body }),
			409,
			'conflict'
		);
		const odd = await call(at(one.PUT, { id: h.id }), {
			method: 'PUT',
			user: me.actor,
			body: { version: back.body.version, data: { ...h.data, extra: [] } }
		});
		expectError(odd, 400, 'invalid');
		await call(at(share.POST, { id: h.id }), { method: 'POST', user: me.actor });
		const theirs = await call(at(one.PUT, { id: h.id }), {
			method: 'PUT',
			user: stranger.actor,
			body: { ...body, version: back.body.version + 1 }
		});
		expectError(theirs, 403, 'forbidden');
	});

	it('exports a file and imports it back; an invalid import is refused with its problems', async () => {
		const { me, stranger, h } = await world();
		const file = await call(at(exp.GET, { id: h.id }), { user: me.actor });
		expect(file.status).toBe(200);
		expect(file.body).toHaveProperty(['manifest.json']);
		expectError(await call(at(exp.GET, { id: h.id }), { user: stranger.actor }), 404, 'not_found');
		const made = await call(imp.POST, {
			method: 'POST',
			user: stranger.actor,
			body: { files: file.body }
		});
		expect(made.status).toBe(201);
		expect(made.body).toMatchObject({ kind: 'variant', ok: true, mine: true });
		const broken = structuredClone(file.body);
		broken['variants.json'][0].faction = 'faction:not-there';
		const refused = await call(imp.POST, {
			method: 'POST',
			user: me.actor,
			body: { files: broken }
		});
		expectError(refused, 400, 'invalid');
		expect(refused.body.error.fields.problem1).toMatch(/does not resolve/);
		expectError(
			await call(imp.POST, { method: 'POST', body: { files: {} } }),
			401,
			'unauthenticated'
		);
	});

	it('deletes; a stranger cannot', async () => {
		const { me, stranger, h } = await world();
		expectError(
			await call(at(one.DELETE, { id: h.id }), { method: 'DELETE', user: stranger.actor }),
			404,
			'not_found'
		);
		expect(
			(await call(at(one.DELETE, { id: h.id }), { method: 'DELETE', user: me.actor })).status
		).toBe(204);
		expectError(await call(at(one.GET, { id: h.id }), { user: me.actor }), 404, 'not_found');
	});

	it('the campaign PATCH takes the allow-list; a set the CM cannot see is refused', async () => {
		const { me, h } = await world();
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm, { kind: 'generic' });
		const patch = (ids: string[], version: number) =>
			call(at(campaignRoute.PATCH, { id: campaign.id }), {
				method: 'PATCH',
				user: cm.actor,
				body: { name: campaign.name, visibility: 'listed', homebrewSets: ids, version }
			});
		expectError(await patch([h.id], campaign.version), 400, 'invalid');
		await call(at(share.POST, { id: h.id }), { method: 'POST', user: me.actor });
		const ok = await patch([h.id], campaign.version);
		expect(ok.status).toBe(200);
		expect(ok.body.homebrewSets).toEqual([h.id]);
	});

	it('documents every homebrew endpoint in the OpenAPI document', () => {
		const paths = openApiDocument().paths ?? {};
		for (const p of [
			'/homebrew',
			'/homebrew/import',
			'/homebrew/{id}',
			'/homebrew/{id}/share',
			'/homebrew/{id}/export'
		])
			expect(paths).toHaveProperty([p]);
	});
});
