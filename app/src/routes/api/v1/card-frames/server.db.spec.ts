/**
 * The card-frames API on real PostgreSQL with the invented rules folders: list, upload and remove; success, a
 * validation error and a permission error (only the Owner changes frames; anyone signed in reads them).
 */
import type { RequestEvent } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openApiDocument } from '#lib/server/http/openapi';
import { person, useTestDatabase } from '#lib/server/testing/db';
import { call } from '#lib/server/testing/http';
import { pngHeader } from '#lib/server/testing/png';
import { RULES_FIXTURE } from '#lib/server/testing/rules';
import { loadAll } from '#lib/server/services/rules';
import type { SessionUser } from '#lib/server/services/audit';
import { cardFrameOut, cardFramesOut } from '#lib/schemas/card-frames';
import * as list from './+server';
import * as one from './[...target]/+server';
import * as uploads from '../../../uploads/frames/[id]/+server';

process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => loadAll(null, RULES_FIXTURE));

type Handler = (event: RequestEvent) => Promise<Response>;
const LG = 'faction:lantern-guild';
const ASH = 'variant:lantern-guild/ash-wardens';

const at =
	(h: Handler, params: Record<string, string>): Handler =>
	(e) =>
		h({ ...e, params } as RequestEvent);

/** A raw PUT with a file body, as a browser's fetch sends it. */
async function put(target: string, user: SessionUser | null, bytes: Uint8Array) {
	const request = new Request('http://localhost:3000/api/v1', {
		method: 'PUT',
		headers: {
			host: 'localhost:3000',
			origin: 'http://localhost:3000',
			'content-type': 'image/png'
		},
		body: new Blob([bytes as Uint8Array<ArrayBuffer>])
	});
	const res = await one.PUT({
		request,
		url: new URL(request.url),
		params: { target },
		locals: { requestId: randomUUID(), user },
		getClientAddress: () => '10.9.9.9'
	} as unknown as RequestEvent);
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : null };
}

const served = (id: string, user: SessionUser | null) =>
	uploads.GET({
		params: { id },
		locals: { requestId: 'r', user },
		request: new Request('http://localhost:3000/'),
		getClientAddress: () => '10.1.1.1'
	} as unknown as RequestEvent);

describe('/api/v1/card-frames', () => {
	it('PUT a frame (a variant id with a slash), GET the list and the file, DELETE it', async () => {
		const owner = await person('owner');
		const user = await person('user');
		const ok = await put(ASH, owner.actor, pngHeader(800, 1000));
		expect(ok.status).toBe(200);
		expect(cardFrameOut.parse(ok.body)).toMatchObject({ target: ASH, version: 1 });

		const got = await call(list.GET, { user: user.actor });
		expect(got.status).toBe(200);
		expect(cardFramesOut.parse(got.body).items.map((f) => f.target)).toEqual([ASH]);

		const id = ok.body.url.split('/').pop().split('?')[0];
		const file = await served(id, user.actor);
		expect(file.headers.get('content-type')).toBe('image/png');
		expect(file.headers.get('cache-control')).toContain('private');
		await expect(served(id, null)).rejects.toMatchObject({ status: 401 });
		await expect(served(randomUUID(), user.actor)).rejects.toMatchObject({ status: 404 });

		const gone = await call(at(one.DELETE, { target: ASH }), {
			method: 'DELETE',
			user: owner.actor
		});
		expect(gone.status).toBe(204);
		expect((await call(list.GET, { user: user.actor })).body.items).toEqual([]);
	});

	it('refuses a wrong-size file, a bad id and an unknown faction (400, 404)', async () => {
		const owner = await person('owner');
		const wrong = await put(LG, owner.actor, pngHeader(1000, 800));
		expect(wrong.status).toBe(400);
		expect(wrong.body.error).toMatchObject({ code: 'invalid', requestId: expect.any(String) });
		expect((await put('unit:lantern-guild/warden', owner.actor, pngHeader(800, 1000))).status).toBe(
			400
		);
		expect((await put('faction:nobody', owner.actor, pngHeader(800, 1000))).status).toBe(404);
		const none = await call(at(one.DELETE, { target: LG }), {
			method: 'DELETE',
			user: owner.actor
		});
		expect(none.status).toBe(404);
	});

	it('refuses anyone but the Owner (403) and anyone signed out (401)', async () => {
		const admin = await person('admin');
		const res = await put(LG, admin.actor, pngHeader(800, 1000));
		expect(res.status).toBe(403);
		expect(res.body.error).toMatchObject({ code: 'forbidden' });
		expect((await call(list.GET, { user: null })).status).toBe(401);
		const del = await call(at(one.DELETE, { target: LG }), { method: 'DELETE', user: admin.actor });
		expect(del.status).toBe(403);
	});

	it('is in the OpenAPI document', () => {
		const paths = Object.keys(openApiDocument().paths ?? {});
		expect(paths).toEqual(expect.arrayContaining(['/card-frames', '/card-frames/{target}']));
	});
});
