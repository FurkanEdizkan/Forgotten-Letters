/**
 * Homebrew on real PostgreSQL with the invented rules folders (core-1.0.2's Lantern Guild and its Ash Wardens
 * variant): copies and blank sets, checks on every save (an invalid draft saves but is not indexed), the compendium
 * seeing a set only once shared, Reload keeping homebrew indexed, export and import, warbands on homebrew and the
 * campaign allow-list, and what deleting, unsharing and anonymising may do.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { campaignPatch } from '#lib/schemas/campaigns';
import { homebrewCreate } from '#lib/schemas/homebrew';
import { warbandCreate } from '#lib/schemas/warbands';
import type { RulesSet } from '#lib/rules/pack';
import { newCampaign, person, useTestDatabase } from '../testing/db';
import { RULES_FIXTURE } from '../testing/rules';
import * as campaigns from './campaigns';
import * as homebrew from './homebrew';
import * as people from './people';
import * as rules from './rules';
import * as seats from './seats';
import * as warbands from './warbands';

process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => rules.loadAll(null, RULES_FIXTURE));

type Ctxd = { ctx: () => Parameters<typeof homebrew.list>[0] };
const copyAsh = (p: Ctxd, name = 'Cinder Wardens') =>
	homebrew.create(
		p.ctx(),
		homebrewCreate.parse({
			name,
			base: 'core-1.0.2',
			start: 'copy',
			of: 'variant:lantern-guild/ash-wardens'
		})
	);
const save = (
	p: Ctxd,
	h: { id: string; version: number; data: unknown },
	edit: (s: RulesSet) => void
) => {
	const data = structuredClone(h.data) as RulesSet;
	edit(data);
	return homebrew.update(p.ctx(), h.id, { version: h.version, data: data as never });
};
/** Allow these homebrew sets in a campaign, through its settings. */
async function allow(cm: Ctxd, campaignId: string, ids: string[]) {
	const c = await campaigns.get(cm.ctx(), campaignId);
	return campaigns.update(
		cm.ctx(),
		campaignId,
		campaignPatch.parse({
			name: c.name,
			description: c.description,
			visibility: c.visibility,
			homebrewSets: ids,
			version: c.version
		})
	);
}

describe('making and checking', () => {
	it('a copy of a variant clones its entries, passes its checks and is indexed for its maker only', async () => {
		const me = await person('user');
		const h = await copyAsh(me);
		expect(h).toMatchObject({ kind: 'variant', ok: true, problems: 0, visibility: 'private' });
		expect(h.copiedFrom).toBe('variant:lantern-guild/ash-wardens');
		const tag = String((h.data.manifest as { id: string }).id);
		const v = (h.data.variants as { id: string; faction: string; name: string }[])[0]!;
		expect(v).toMatchObject({ faction: 'faction:lantern-guild', name: 'Cinder Wardens' });
		expect(v.id.startsWith(`variant:${tag}/`)).toBe(true);
		const ix = await rules.index(me.ctx(), h.setId);
		expect(ix.names[v.id]).toMatchObject({ name: 'Cinder Wardens' });
		const stranger = await person('user');
		await expect(rules.index(stranger.ctx(), h.setId)).rejects.toMatchObject({ code: 'not_found' });
		expect((await rules.sets(stranger.ctx(), true)).map((s) => s.id)).not.toContain(h.setId);
		expect((await rules.sets(me.ctx(), true)).map((s) => s.id)).toContain(h.setId);
		expect((await homebrew.list(stranger.ctx())).shared).toEqual([]);
		// Owners see every set.
		const owner = await person('owner');
		await expect(rules.index(owner.ctx(), h.setId)).resolves.toBeTruthy();
		await homebrew.share(me.ctx(), h.id, true);
		await expect(rules.index(stranger.ctx(), h.setId)).resolves.toBeTruthy();
		expect((await homebrew.list(stranger.ctx())).shared).toMatchObject([{ id: h.id, mine: false }]);
	});

	it('a draft with problems is saved with its report; players keep the last good version until it is fixed', async () => {
		const me = await person('user');
		const h = await homebrew.create(
			me.ctx(),
			homebrewCreate.parse({ name: 'Ash Crows', base: 'core-1.0.2', start: 'faction' })
		);
		expect(h).toMatchObject({ ok: true, published: { version: 1 } });
		const ns = String((h.data.manifest as { id: string }).id);
		const item = {
			id: `item:${ns}/crow-bill`,
			name: 'Crow Bill',
			category: 'melee',
			type: '2-Handed',
			keywords: [{ kw: 'kw:not-there' }]
		};
		const bad = await save(me, h, (s) => void s.items.push(item as never));
		expect(bad).toMatchObject({ ok: false, problems: 1, version: 2, published: { version: 1 } });
		expect(bad.report.map((p) => p.message).join(' ')).toMatch(/kw:not-there does not resolve/);
		// The cache serves version 1: indexed, without the broken item; a reload keeps it so.
		expect((await rules.index(me.ctx(), h.setId)).names[item.id]).toBeUndefined();
		await rules.loadAll(null, RULES_FIXTURE);
		const after = await homebrew.get(me.ctx(), h.id);
		expect(after).toMatchObject({ ok: false, published: { version: 1 } });
		expect(after.report).toEqual(bad.report);
		await expect(save(me, h, () => {})).rejects.toMatchObject({ code: 'conflict' });
		const good = await save(me, bad, (s) => void (s.items[0]!.keywords = [{ kw: 'kw:steady' }]));
		expect(good).toMatchObject({ ok: true, problems: 0, report: [], published: { version: 3 } });
		expect((await rules.index(me.ctx(), h.setId)).names[item.id]?.name).toBe('Crow Bill');
		// Someone else can neither see nor change it.
		const other = await person('user');
		await expect(save(other, good, () => {})).rejects.toMatchObject({ code: 'not_found' });
	});

	it('another player’s warband on a shared set keeps loading and checking while its draft is broken', async () => {
		const me = await person('user');
		const h = await copyAsh(me);
		const shared = await homebrew.share(me.ctx(), h.id, true);
		const v = (h.data.variants as { id: string }[])[0]!.id;
		const other = await person('user');
		const w = await warbands.create(
			other.ctx(),
			warbandCreate.parse({
				name: 'Borrowed Cinders',
				factionId: 'faction:lantern-guild',
				variantId: v,
				rules: `core-1.0.2+${h.setId}`
			})
		);
		const broken = await save(me, shared, (s) => void (s.variants[0]!.faction = 'faction:nowhere'));
		expect(broken).toMatchObject({ ok: false, published: shared.published });
		const seen = await warbands.get(other.ctx(), w.id);
		expect(seen).toMatchObject({ variantName: 'Cinder Wardens', factionName: 'Lantern Guild' });
		expect(seen.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['empty', 'leader']));
		await expect(rules.index(other.ctx(), h.setId)).resolves.toBeTruthy();
		// The fix becomes the new last good version and is what the warband now reads.
		const fixed = await save(me, broken, (s) => {
			s.variants[0]!.faction = 'faction:lantern-guild';
			s.variants[0]!.name = 'Cinder Wardens Reborn';
		});
		expect(fixed).toMatchObject({ ok: true, published: { version: broken.version + 1 } });
		expect((await warbands.get(other.ctx(), w.id)).variantName).toBe('Cinder Wardens Reborn');
	});

	it('a reload of the folders keeps homebrew indexed', async () => {
		const me = await person('user');
		const h = await copyAsh(me);
		await rules.loadAll(null, RULES_FIXTURE);
		expect((await rules.sets(me.ctx(), true)).find((s) => s.id === h.setId)).toMatchObject({
			ok: true
		});
		// The Owner's folder list and GET /rules/sets keep to folders.
		expect((await rules.sets((await person('owner')).ctx())).map((s) => s.id)).not.toContain(
			h.setId
		);
		expect((await rules.listSets()).map((s) => s.id)).not.toContain(h.setId);
	});

	it('exports as folder files and imports under a new namespace; an invalid file is refused', async () => {
		const me = await person('user');
		const h = await copyAsh(me);
		const out = JSON.parse((await homebrew.exportOf(me.ctx(), h.id)).body);
		expect(Object.keys(out)).toEqual(expect.arrayContaining(['manifest.json', 'variants.json']));
		const again = await homebrew.importSet(me.ctx(), { files: out, name: 'Cinder Again' });
		expect(again).toMatchObject({ name: 'Cinder Again', kind: 'variant', ok: true });
		expect(again.data.manifest).not.toEqual(h.data.manifest);
		out['units.json'][0].keywords = [{ kw: 'kw:not-there' }];
		await expect(homebrew.importSet(me.ctx(), { files: out })).rejects.toMatchObject({
			code: 'invalid',
			fields: { problem1: expect.stringMatching(/does not resolve/) }
		});
	});
});

describe('warbands and campaigns', () => {
	it('builds a warband on homebrew; a seat takes it only once the CM allows that homebrew', async () => {
		const me = await person('user');
		const h = await copyAsh(me);
		const v = (h.data.variants as { id: string }[])[0]!.id;
		const choices = await warbands.choices(me.ctx(), `core-1.0.2+${h.setId}`);
		expect(choices.picked).toBe(`core-1.0.2+${h.setId}`);
		expect(choices.factions.map((f) => f.id)).toEqual(['faction:lantern-guild']);
		expect(choices.factions[0]!.variants.map((x) => x.id)).toContain(v);
		const w = await warbands.create(
			me.ctx(),
			warbandCreate.parse({
				name: 'Cinder Band',
				factionId: 'faction:lantern-guild',
				variantId: v,
				rules: `core-1.0.2+${h.setId}`
			})
		);
		expect(w).toMatchObject({ rulesSet: 'core-1.0.2', rulesExpansions: [h.setId] });
		// A stranger cannot build on a private set.
		const stranger = await person('user');
		await expect(
			warbands.create(
				stranger.ctx(),
				warbandCreate.parse({
					name: 'X',
					factionId: 'faction:lantern-guild',
					rules: `core-1.0.2+${h.setId}`
				})
			)
		).rejects.toMatchObject({ code: 'not_found' });

		const cm = await person('admin');
		const { campaign, seats: list } = await newCampaign(cm, { kind: 'generic' });
		await seats.assign(cm.ctx(), campaign.id, list[0]!.id, me.row.id);
		await expect(
			warbands.assignToSeat(me.ctx(), campaign.id, { warbandId: w.id })
		).rejects.toMatchObject({
			code: 'conflict',
			message: /does not allow the homebrew Cinder Wardens/
		});
		// The CM cannot allow a set they cannot see; once shared, they can.
		await expect(allow(cm, campaign.id, [h.id])).rejects.toMatchObject({ code: 'invalid' });
		await homebrew.share(me.ctx(), h.id, true);
		expect((await allow(cm, campaign.id, [h.id])).homebrewSets).toEqual([h.id]);
		const seated = await warbands.assignToSeat(me.ctx(), campaign.id, { warbandId: w.id });
		expect(seated.seat).toMatchObject({ campaignId: campaign.id });
		// While it sits there, the homebrew stays allowed, it stays shared, and it cannot be deleted.
		await expect(allow(cm, campaign.id, [])).rejects.toMatchObject({ code: 'conflict' });
		await expect(homebrew.remove(me.ctx(), h.id)).rejects.toMatchObject({ code: 'conflict' });
	});

	it('a recheck into a campaign keeps the warband’s homebrew; a broken draft keeps it allowed', async () => {
		const me = await person('user');
		const h = await copyAsh(me);
		await homebrew.share(me.ctx(), h.id, true);
		const w = await warbands.create(
			me.ctx(),
			warbandCreate.parse({
				name: 'Mire Cinders',
				factionId: 'faction:lantern-guild',
				rules: `core-1.0.2+mire-front-1.0+${h.setId}`
			})
		);
		const cm = await person('admin');
		const { campaign, seats: list } = await newCampaign(cm, { kind: 'generic' });
		await seats.assign(cm.ctx(), campaign.id, list[0]!.id, me.row.id);
		await allow(cm, campaign.id, [h.id]);
		await expect(
			warbands.assignToSeat(me.ctx(), campaign.id, { warbandId: w.id })
		).rejects.toMatchObject({ code: 'conflict', fields: { recheck: 'core-1.0.2' } });
		const moved = await warbands.assignToSeat(me.ctx(), campaign.id, {
			warbandId: w.id,
			recheck: true
		});
		expect(moved).toMatchObject({ rulesSet: 'core-1.0.2', rulesExpansions: [h.setId] });
		// The maker saves a draft with problems: the CM can still save the settings.
		const fresh = await homebrew.get(me.ctx(), h.id);
		const bad = await save(me, fresh, (s) => void (s.variants[0]!.faction = 'faction:nowhere'));
		expect(bad.ok).toBe(false);
		await expect(allow(cm, campaign.id, [h.id])).resolves.toMatchObject({ homebrewSets: [h.id] });
	});

	it('refuses homebrew built on rules the campaign does not play', async () => {
		const me = await person('user');
		const h = await homebrew.create(
			me.ctx(),
			homebrewCreate.parse({ name: 'Bog Kit', base: 'mire-front-1.0', start: 'items' })
		);
		await homebrew.share(me.ctx(), h.id, true);
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm, { kind: 'generic' });
		await expect(allow(cm, campaign.id, [h.id])).rejects.toMatchObject({
			code: 'invalid',
			fields: { homebrewSets: expect.stringMatching(/builds on .*mire-front-1.0/) }
		});
	});

	it('unsharing is refused while others build on it; anonymising drops private homebrew only', async () => {
		const me = await person('user');
		const shared = await copyAsh(me, 'Shared Wardens');
		const mine = await copyAsh(me, 'Private Wardens');
		await homebrew.share(me.ctx(), shared.id, true);
		const other = await person('user');
		await warbands.create(
			other.ctx(),
			warbandCreate.parse({
				name: 'Borrowed',
				factionId: 'faction:lantern-guild',
				rules: `core-1.0.2+${shared.setId}`
			})
		);
		await expect(homebrew.share(me.ctx(), shared.id, false)).rejects.toMatchObject({
			code: 'conflict',
			message: /Borrowed/
		});
		const owner = await person('owner');
		const disabled = await people.setDisabled(owner.ctx(), me.row.id, true, me.row.version);
		await people.anonymise(owner.ctx(), me.row.id, disabled.version);
		const left = await homebrew.list(other.ctx());
		expect(left.shared).toMatchObject([{ id: shared.id, ownerName: 'Former member' }]);
		await expect(homebrew.get(owner.ctx(), mine.id)).rejects.toMatchObject({ code: 'not_found' });
		expect((await rules.listSets(true)).map((s) => s.id)).not.toContain(mine.setId);
	});
});
