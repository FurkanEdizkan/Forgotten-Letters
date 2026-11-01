/**
 * Card frames on real PostgreSQL with the invented rules folders (the Lantern Guild and its Ash Wardens variant).
 * The Sin lookup uses the engine's invented Court of Stubs with a dedication that lays a variant.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { rulesSet } from '#lib/rules/pack';
import { warbandCreate } from '#lib/schemas/warbands';
import { core } from '#lib/warbands/fixtures/core';
import { resolveFaction } from '#lib/warbands/resolve';
import { db } from '../db';
import { config } from '../infra/config';
import * as repo from '../repos/card-frames';
import { person, sql, useTestDatabase } from '../testing/db';
import { pngHeader } from '../testing/png';
import { RULES_FIXTURE } from '../testing/rules';
import * as frames from './card-frames';
import { loadAll } from './rules';
import * as warbands from './warbands';

process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => loadAll(null, RULES_FIXTURE));

const LG = 'faction:lantern-guild';
const ASH = 'variant:lantern-guild/ash-wardens';
const FRAME = pngHeader(800, 1000);
const fileOf = (id: string) => join(config().UPLOADS_DIR, 'frames', id);

describe('the Owner sets and removes frames', () => {
	it('lists factions with their variants, uploads, replaces and removes a frame', async () => {
		const owner = await person('owner');
		const before = await frames.targets(owner.ctx());
		expect(before.map((t) => [t.id, t.kind, t.frame])).toEqual(
			expect.arrayContaining([
				[LG, 'faction', null],
				[ASH, 'variant', null]
			])
		);
		// The variant sits right under its faction.
		const ids = before.map((t) => t.id);
		expect(ids.indexOf(ASH)).toBe(ids.indexOf(LG) + 1);

		const first = await frames.setFrame(owner.ctx(), LG, FRAME);
		expect(first).toMatchObject({ target: LG, version: 1 });
		expect(first.url).toMatch(/^\/uploads\/frames\/[0-9a-f-]+\?v=1$/);
		const row = await repo.byTarget(db(), LG);
		expect(existsSync(fileOf(row!.id))).toBe(true);

		const second = await frames.setFrame(owner.ctx(), LG, FRAME);
		expect(second.version).toBe(2);
		expect((await frames.list(owner.ctx())).map((f) => f.target)).toEqual([LG]);
		expect((await frames.frameFile(owner.ctx(), row!.id)).bytes.byteLength).toBe(FRAME.byteLength);

		const audit =
			await sql()`select action from auth.audit_log where action like 'card_frame.%' order by id`;
		expect(audit.map((a) => a.action)).toEqual(['card_frame.set', 'card_frame.set']);

		await frames.clearFrame(owner.ctx(), LG);
		expect(await frames.list(owner.ctx())).toEqual([]);
		expect(existsSync(fileOf(row!.id))).toBe(false);
		await expect(frames.clearFrame(owner.ctx(), LG)).rejects.toMatchObject({ code: 'not_found' });
	});

	it('refuses anyone but the Owner; anyone signed in may read', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		const user = await person('user');
		await expect(frames.setFrame(admin.ctx(), LG, FRAME)).rejects.toMatchObject({
			code: 'forbidden'
		});
		await expect(frames.targets(user.ctx())).rejects.toMatchObject({ code: 'forbidden' });
		const f = await frames.setFrame(owner.ctx(), LG, FRAME);
		await expect(frames.clearFrame(user.ctx(), LG)).rejects.toMatchObject({ code: 'forbidden' });
		expect(await frames.list(user.ctx())).toHaveLength(1);
		const id = f.url.split('/').pop()!.split('?')[0]!;
		expect((await frames.frameFile(user.ctx(), id)).version).toBe(1);
		await expect(frames.list({ ...user.ctx(), actor: null })).rejects.toMatchObject({
			code: 'unauthenticated'
		});
	});

	it('refuses a file that is not a PNG, the wrong size, too big, or a target that is not loaded', async () => {
		const owner = await person('owner');
		const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
		await expect(frames.setFrame(owner.ctx(), LG, jpeg)).rejects.toMatchObject({
			code: 'invalid',
			fields: { image: expect.any(String) }
		});
		await expect(frames.setFrame(owner.ctx(), LG, pngHeader(1200, 800))).rejects.toMatchObject({
			code: 'invalid',
			message: expect.stringContaining('1200×800')
		});
		const big = new Uint8Array(2 * 1024 * 1024 + 1);
		big.set(FRAME);
		await expect(frames.setFrame(owner.ctx(), LG, big)).rejects.toMatchObject({ code: 'invalid' });
		await expect(frames.setFrame(owner.ctx(), 'faction:nobody', FRAME)).rejects.toMatchObject({
			code: 'not_found'
		});
		expect(await frames.list(owner.ctx())).toEqual([]);
	});
});

describe('a warband’s frame', () => {
	it('is its variant’s, else its faction’s, else none (the built-in frame)', async () => {
		const owner = await person('owner');
		const p = await person('user');
		const plain = await warbands.create(p.ctx(), warbandCreate.parse({ name: 'A', factionId: LG }));
		const ash = await warbands.create(
			p.ctx(),
			warbandCreate.parse({ name: 'B', factionId: LG, variantId: ASH })
		);
		expect(plain.frame).toBeNull();

		const lg = await frames.setFrame(owner.ctx(), LG, FRAME);
		expect((await warbands.get(p.ctx(), plain.id)).frame).toBe(lg.url);
		expect((await warbands.get(p.ctx(), ash.id)).frame).toBe(lg.url);

		const own = await frames.setFrame(owner.ctx(), ASH, FRAME);
		expect((await warbands.get(p.ctx(), ash.id)).frame).toBe(own.url);
		expect((await warbands.get(p.ctx(), plain.id)).frame).toBe(lg.url);
	});

	it('of a Court warband is its Sin’s: the dedication lays the variant the frame is looked up by', async () => {
		const set = rulesSet.parse({
			...core,
			factions: core.factions.map((f) =>
				f.id === 'faction:court'
					? { ...f, dedications: [{ key: 'greed', name: 'Greed', variant: 'variant:court/greed' }] }
					: f
			),
			variants: [
				...core.variants,
				{ id: 'variant:court/greed', faction: 'faction:court', name: 'Court of Greed' }
			]
		});
		const greed = resolveFaction(set, 'faction:court', undefined, 'greed');
		const owner = await person('owner');
		await repo.upsert(db(), 'faction:court', owner.row.id);
		const sin = await repo.upsert(db(), 'variant:court/greed', owner.row.id);
		expect(await frames.frameFor(db(), greed)).toBe(frames.frameUrl(sin));
		expect(await frames.frameFor(db(), resolveFaction(set, 'faction:court'))).toMatch(/\?v=1$/);
	});
});
