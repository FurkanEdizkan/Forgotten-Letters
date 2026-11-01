import type { RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it } from 'vitest';
import { openApiDocument } from '#lib/server/http/openapi';
import { person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import { RULES_FIXTURE } from '#lib/server/testing/rules';
import { diffOut, nodeOut, nodePage, ruleSetList } from '#lib/schemas/rules';
import { loadAll } from '#lib/server/services/rules';
import * as sets from './sets/+server';
import * as reload from './sets/reload/+server';
import * as nodes from './nodes/+server';
import * as node from './node/+server';
import * as diff from './diff/+server';

// Read with the other settings, before the database helpers read them.
process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => loadAll(null, RULES_FIXTURE));

type Handler = (event: RequestEvent) => Promise<Response>;
const at =
	(h: Handler, query: string): Handler =>
	(e) =>
		h({ ...e, url: new URL(`http://localhost:3000/api/v1${query}`) } as RequestEvent);

const expectError = (
	res: { status: number; body: { error: { code: string } } },
	status: number,
	code: string
) => {
	expect(res.status).toBe(status);
	expect(res.body.error).toMatchObject({ code, requestId: expect.any(String) });
};

describe('GET /rules/sets and POST /rules/sets/reload', () => {
	it('lists the folders with their reports', async () => {
		const { actor } = await person('user');
		const res = await call(sets.GET, { user: actor });
		expect(res.status).toBe(200);
		expect(ruleSetList.parse(res.body).items.find((s) => s.id === 'broken-0.1')).toMatchObject({
			ok: false,
			problems: [{ file: 'items.json', id: 'item:rusty-blade' }]
		});
		expectError(await call(sets.GET), 401, 'unauthenticated');
	});
	it('reloads for an Owner only', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const res = await call(reload.POST, { method: 'POST', user: owner.actor });
		expect(res.status).toBe(200);
		expect(ruleSetList.parse(res.body).items).toHaveLength(4);
		expectError(await call(reload.POST, { method: 'POST', user: admin.actor }), 403, 'forbidden');
		expectError(await call(reload.POST, { method: 'POST' }), 401, 'unauthenticated');
	});
});

describe('GET /rules/nodes', () => {
	it('searches a set', async () => {
		const { actor } = await person('user');
		const res = await call(at(nodes.GET, '?set=core-1.0.2&q=rifle&type=item'), { user: actor });
		expect(res.status).toBe(200);
		expect(nodePage.parse(res.body)).toEqual({
			items: [{ id: 'item:hook-rifle', type: 'item', name: 'Hook Rifle', setId: 'core-1.0.2' }],
			next: null
		});
	});
	it('400 on a bad query, 404 for a set not loaded, 401 signed out', async () => {
		const { actor } = await person('user');
		expectError(await call(at(nodes.GET, '?set=Core!&limit=500'), { user: actor }), 400, 'invalid');
		expectError(
			await call(at(nodes.GET, '?set=core-1.0.2&type=wizard'), { user: actor }),
			400,
			'invalid'
		);
		expectError(await call(at(nodes.GET, '?set=broken-0.1'), { user: actor }), 404, 'not_found');
		expectError(await call(at(nodes.GET, '?set=core-1.0.2')), 401, 'unauthenticated');
	});
});

describe('GET /rules/node', () => {
	it('gives an element with its links and graph', async () => {
		const { actor } = await person('user');
		const id = encodeURIComponent('item:hook-rifle');
		const res = await call(at(node.GET, `?set=core-1.0.2&id=${id}&depth=1`), { user: actor });
		expect(res.status).toBe(200);
		const out = nodeOut.parse(res.body);
		expect(out.node).toMatchObject({ id: 'item:hook-rifle', name: 'Hook Rifle' });
		expect(out.out).toContainEqual({
			kind: 'has_keyword',
			id: 'kw:volley',
			type: 'kw',
			name: 'Volley'
		});
		expect(out.graph.nodes.every((n) => n.depth <= 1)).toBe(true);
	});
	it('400 on a bad id or depth, 404 for an unknown element, 401 signed out', async () => {
		const { actor } = await person('user');
		expectError(
			await call(at(node.GET, '?set=core-1.0.2&id=Hook'), { user: actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(node.GET, '?set=core-1.0.2&id=item:x&depth=3'), { user: actor }),
			400,
			'invalid'
		);
		expectError(
			await call(at(node.GET, '?set=core-1.0.2&id=item:none'), { user: actor }),
			404,
			'not_found'
		);
		expectError(await call(at(node.GET, '?set=core-1.0.2&id=item:none')), 401, 'unauthenticated');
	});
});

describe('GET /rules/diff', () => {
	it('compares two versions', async () => {
		const { actor } = await person('user');
		const res = await call(at(diff.GET, '?from=core-1.0.1&to=core-1.0.2'), { user: actor });
		expect(res.status).toBe(200);
		const d = diffOut.parse(res.body);
		expect(d.changed.find((c) => c.id === 'item:hook-rifle')!.fields).toEqual([
			{ path: 'range', from: '18"', to: '24"' }
		]);
	});
	it('400 without both versions, 404 for one not loaded, 401 signed out', async () => {
		const { actor } = await person('user');
		expectError(await call(at(diff.GET, '?from=core-1.0.1'), { user: actor }), 400, 'invalid');
		expectError(
			await call(at(diff.GET, '?from=core-1.0.1&to=broken-0.1'), { user: actor }),
			404,
			'not_found'
		);
		expectError(await call(at(diff.GET, '?from=core-1.0.1&to=core-1.0.2')), 401, 'unauthenticated');
	});
});

describe('the OpenAPI document', () => {
	it('lists every rules path', () => {
		const paths = Object.keys(openApiDocument().paths ?? {});
		for (const p of [
			'/rules/sets',
			'/rules/sets/reload',
			'/rules/nodes',
			'/rules/node',
			'/rules/diff'
		])
			expect(paths).toContain(p);
	});
});
