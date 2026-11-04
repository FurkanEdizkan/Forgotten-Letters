/**
 * Warbands on real PostgreSQL with the invented rules folders (the Lantern Guild of core-1.0.2: a Warden at 60, the
 * one allowed; Torchbearers at 30; a Sellsword at 70; 700 starting Ducats, no Glory).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { campaignPatch } from '#lib/schemas/campaigns';
import { warbandCreate } from '#lib/schemas/warbands';
import { newCampaign, person, sql, useTestDatabase } from '../testing/db';
import { RULES_FIXTURE } from '../testing/rules';
import { config } from '../infra/config';
import * as campaigns from './campaigns';
import * as people from './people';
import * as roster from './warband-roster';
import * as holdings from './warband-stash';
import * as items from './warband-items';
import * as images from './fighter-images';
import * as seats from './seats';
import * as warbands from './warbands';
import { loadAll } from './rules';

process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();
beforeEach(() => loadAll(null, RULES_FIXTURE));

const LG = 'faction:lantern-guild';
const WARDEN = 'unit:lantern-guild/warden';
const TORCH = 'unit:lantern-guild/torchbearer';
const RIFLE = 'line:lantern-guild/hook-rifle';
const SMOKE = 'line:lantern-guild/smoke-pot';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function player() {
	const p = await person('user', { displayName: 'Ansel' });
	const make = (over: Record<string, unknown> = {}) =>
		warbands.create(p.ctx(), warbandCreate.parse({ name: 'Lamp Wardens', factionId: LG, ...over }));
	return { ...p, make };
}

/** A generic campaign (core-1.0.2, no expansion) with `p` in seat 1. */
async function seated(p: { row: { id: string } }) {
	const cm = await person('admin');
	const { campaign, seats: list } = await newCampaign(cm, { kind: 'generic' });
	await seats.assign(cm.ctx(), campaign.id, list[0]!.id, p.row.id);
	return { cm, campaign, seatId: list[0]!.id };
}

describe('create and read', () => {
	it('builds for the newest core, with the faction’s starting Ducats as limit and banks', async () => {
		const p = await player();
		const w = await p.make();
		expect(w).toMatchObject({
			rulesSet: 'core-1.0.2',
			rulesExpansions: [],
			factionName: 'Lantern Guild',
			ducatLimit: 700,
			stashDucats: 700,
			unspentGlory: 0,
			rating: { ducats: 0, glory: 0 },
			canEdit: true,
			seat: null
		});
		expect(w.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['empty', 'leader']));
		expect(await warbands.listMine(p.ctx())).toMatchObject([{ id: w.id, name: 'Lamp Wardens' }]);
		const other = await person('user');
		await expect(warbands.get(other.ctx(), w.id)).rejects.toMatchObject({ code: 'not_found' });
	});
	it('takes a chosen limit, a variant and a Patron; refuses a Patron it may not serve', async () => {
		const p = await player();
		const w = await p.make({
			ducatLimit: 100,
			variantId: 'variant:lantern-guild/ash-wardens',
			rules: 'core-1.0.2+mire-front-1.0'
		});
		expect(w).toMatchObject({ ducatLimit: 100, stashDucats: 100, variantName: 'Ash Wardens' });
		expect(w.rulesExpansions).toEqual(['mire-front-1.0']);
		await expect(p.make({ patronId: 'patron:nobody' })).rejects.toMatchObject({
			code: 'invalid',
			fields: { patronId: expect.any(String) }
		});
		expect((await p.make({ patronId: 'patron:the-keeper' })).patronName).toBe('The Keeper');
	});
	it('offers the rules, factions, variants and Patrons to pick from', async () => {
		const p = await player();
		const c = await warbands.choices(p.ctx());
		expect(c.picked).toBe('core-1.0.2');
		expect(c.rules.map((r) => r.value)).toEqual([
			'core-1.0.2',
			'core-1.0.1',
			'core-1.0.2+mire-front-1.0'
		]);
		expect(c.factions).toMatchObject([
			{
				id: LG,
				startDucats: 700,
				variants: [{ name: 'Ash Wardens' }],
				patrons: { '': [{ id: 'patron:the-keeper' }] }
			}
		]);
	});
});

describe('the roster', () => {
	it('recruits from the banks and refuses a second Warden with its reason', async () => {
		const p = await player();
		const w = await p.make({ ducatLimit: 100 });
		let v = await roster.recruit(p.ctx(), w.id, { unitId: WARDEN, name: 'Old Marl' });
		expect(v).toMatchObject({ stashDucats: 40, rating: { ducats: 60 } });
		expect(v.fighters[0]).toMatchObject({ name: 'Old Marl', group: 'elite', unitName: 'Warden' });
		expect(v.fighters[0]!.kit).toMatchObject([{ name: 'Signal Lantern', fixed: true }]);
		await expect(roster.recruit(p.ctx(), w.id, { unitId: WARDEN })).rejects.toMatchObject({
			code: 'conflict',
			message: expect.stringMatching(/Limit reached \(1\/1\)/)
		});
		v = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		await expect(roster.recruit(p.ctx(), w.id, { unitId: TORCH })).rejects.toMatchObject({
			message: expect.stringMatching(/Costs 30 Ducats; 10 in the strongbox/)
		});
		const units = await roster.recruits(p.ctx(), w.id);
		expect(units.find((u) => u.unitId === TORCH)).toMatchObject({ ok: false, cost: 30 });
		expect(v.issues.filter((i) => i.severity === 'error')).toEqual([]);
	});
	it('buys kit, refunds it at what it cost before the first game; refuses kit over its limit', async () => {
		const p = await player();
		const w = await p.make();
		let v = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const fid = v.fighters[0]!.id;
		v = await roster.buy(p.ctx(), w.id, fid, RIFLE);
		expect(v).toMatchObject({ stashDucats: 660, rating: { ducats: 40 } });
		const lines = await roster.armoury(p.ctx(), w.id, fid);
		expect(lines.find((l) => l.lineId === 'line:lantern-guild/pavise')).toMatchObject({
			ok: false
		});
		// Smoke Pots: two in the warband at most (one per model, grenades being one type each).
		await roster.buy(p.ctx(), w.id, fid, SMOKE);
		for (let i = 0; i < 2; i++) v = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		await roster.buy(p.ctx(), w.id, v.fighters[1]!.id, SMOKE);
		await expect(roster.buy(p.ctx(), w.id, v.fighters[2]!.id, SMOKE)).rejects.toMatchObject({
			message: expect.stringMatching(/Limit 2\/2 used/)
		});
		v = await items.leave(p.ctx(), w.id, fid, RIFLE, 'refund');
		expect(v).toMatchObject({ stashDucats: 600, rating: { ducats: 100 } });
		await expect(items.leave(p.ctx(), w.id, fid, RIFLE, 'refund')).rejects.toMatchObject({
			code: 'not_found'
		});
	});
	it('recruits with upgrades and a loadout, checked as one purchase', async () => {
		const p = await player();
		let w = await p.make();
		await expect(
			roster.recruit(p.ctx(), w.id, { unitId: WARDEN, upgrades: ['upgrade:lantern-guild/veteran'] })
		).rejects.toMatchObject({ message: expect.stringMatching(/Costs 1 Glory; 0/) });
		w = await warbands.patch(p.ctx(), w.id, { version: w.version, unspentGlory: 1 });
		w = await roster.recruit(p.ctx(), w.id, {
			unitId: WARDEN,
			upgrades: ['upgrade:lantern-guild/veteran']
		});
		expect(w).toMatchObject({
			unspentGlory: 0,
			stashDucats: 640,
			rating: { ducats: 60, glory: 1 }
		});
		expect(w.fighters[0]!.upgrades).toEqual([
			{ id: 'upgrade:lantern-guild/veteran', name: 'Veteran' }
		]);

		const mire = await p.make({ rules: 'core-1.0.2+mire-front-1.0', name: 'Bog Lamps' });
		const units = await roster.recruits(p.ctx(), mire.id);
		const runner = units.find((u) => u.unitId === 'unit:lantern-guild/bog-runner')!;
		expect(runner.loadouts).toEqual([
			{
				label: 'Cudgel and Mire Boots',
				lines: ['line:lantern-guild/cudgel', 'line:lantern-guild/mire-boots']
			},
			{ label: 'Hook Rifle', lines: [RIFLE] },
			{ label: 'Long Pike', lines: ['line:lantern-guild/pike'] }
		]);
		expect(units.find((u) => u.unitId === WARDEN)!.upgrades).toMatchObject([
			{ upgradeId: 'upgrade:lantern-guild/veteran', cost: 1, currency: 'glory' }
		]);
		const got = await roster.recruit(p.ctx(), mire.id, {
			unitId: runner.unitId,
			kit: runner.loadouts[0]!.lines
		});
		expect(got.fighters[0]!.kit.map((k) => k.name)).toEqual(['Cudgel', 'Mire Boots']);
		expect(got.rating.ducats).toBe(25 + 2 + 4);
		await expect(
			roster.recruit(p.ctx(), mire.id, {
				unitId: runner.unitId,
				kit: [RIFLE, 'line:lantern-guild/pike']
			})
		).rejects.toMatchObject({ message: expect.stringMatching(/Only one of/) });
	});
	it('upgrades from Glory; edits a fighter (to Dead) with its version; removes with a refund', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: WARDEN });
		const warden = w.fighters[0]!;
		await expect(
			roster.upgrade(p.ctx(), w.id, warden.id, 'upgrade:lantern-guild/veteran')
		).rejects.toMatchObject({ message: expect.stringMatching(/Costs 1 Glory; 0/) });
		w = await warbands.patch(p.ctx(), w.id, { version: w.version, unspentGlory: 2 });
		w = await roster.upgrade(p.ctx(), w.id, warden.id, 'upgrade:lantern-guild/veteran');
		expect(w).toMatchObject({ unspentGlory: 1, rating: { glory: 1 } });
		w = await roster.editFighter(p.ctx(), w.id, warden.id, {
			version: w.fighters[0]!.version,
			group: 'dead',
			xp: 4,
			injuries: ['Scarred', 'a limp']
		});
		expect(w.fighters[0]).toMatchObject({
			status: 'dead',
			xp: 4,
			injuries: [
				{ ref: 'table:wounds#7-12', name: 'Scarred' },
				{ ref: 'a limp', name: 'a limp' }
			]
		});
		expect(w.rating).toEqual({ ducats: 0, glory: 0 });
		await expect(
			roster.editFighter(p.ctx(), w.id, warden.id, { version: 1, name: 'Late' })
		).rejects.toMatchObject({ code: 'conflict' });
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const torch = w.fighters[1]!;
		w = await roster.removeFighter(p.ctx(), w.id, torch.id, 'refund');
		expect(w).toMatchObject({ stashDucats: 640, fighters: [{ id: warden.id }] });
	});
	it('stashes kit, refunds it, moves it to a fighter; fireteams and locations', async () => {
		const p = await player();
		let w = await p.make();
		w = await holdings.stashBuy(p.ctx(), w.id, RIFLE);
		expect(w).toMatchObject({ stashDucats: 690, stash: [{ name: 'Hook Rifle' }] });
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const [a, b] = w.fighters.map((x) => x.id);
		w = await items.move(p.ctx(), w.id, RIFLE, 'arsenal', a!);
		expect(w).toMatchObject({ stashDucats: 630, stash: [], rating: { ducats: 70 } });
		await holdings.stashBuy(p.ctx(), w.id, SMOKE);
		w = await items.leave(p.ctx(), w.id, 'arsenal', SMOKE, 'refund');
		expect(w.stashDucats).toBe(630);
		w = await holdings.setFireteams(p.ctx(), w.id, [[a!, b!]]);
		expect(w.fireteams).toEqual([[a, b]]);
		await expect(
			holdings.setFireteams(p.ctx(), w.id, [
				[a!, b!],
				[a!, b!],
				[a!, b!]
			])
		).rejects.toMatchObject({ code: 'conflict' });
		const moved = await roster.editFighter(p.ctx(), w.id, b!, {
			version: w.fighters[1]!.version,
			group: 'dead'
		});
		expect(moved.fireteams).toEqual([]);
		w = await roster.editFighter(p.ctx(), w.id, b!, {
			version: moved.fighters[1]!.version,
			group: 'troop'
		});
		w = await holdings.setFireteams(p.ctx(), w.id, [[a!, b!]]);
		w = await holdings.setLocations(p.ctx(), w.id, [
			{ name: 'The Toll Bridge', note: 'Two lamps' }
		]);
		expect(w.locations).toEqual([{ name: 'The Toll Bridge', note: 'Two lamps' }]);
		w = await roster.removeFighter(p.ctx(), w.id, b!);
		expect(w.fireteams).toEqual([]);
	});
	it('patches with a version check and deletes', async () => {
		const p = await player();
		const w = await p.make();
		const next = await warbands.patch(p.ctx(), w.id, { version: w.version, name: 'Ash Lamps' });
		expect(next.name).toBe('Ash Lamps');
		await expect(
			warbands.patch(p.ctx(), w.id, { version: w.version, name: 'Again' })
		).rejects.toMatchObject({ code: 'conflict' });
		await warbands.remove(p.ctx(), w.id);
		await expect(warbands.get(p.ctx(), w.id)).rejects.toMatchObject({ code: 'not_found' });
	});
});

describe('stats with what changes them', () => {
	it('bought armour lowers Armour and is named; an unchanged fighter lists nothing', async () => {
		const p = await player();
		const w = await p.make();
		await roster.recruit(p.ctx(), w.id, {
			unitId: WARDEN,
			kit: ['line:lantern-guild/quilted-coat']
		});
		const v = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const [warden, torch] = v.fighters;
		expect(warden!.stats).toMatchObject({ armour: '-1', movement: '6"' });
		expect(warden!.statChanges).toEqual([
			{ stat: 'armour', printed: '0', delta: -1, from: [{ name: 'Quilted Coat', delta: -1 }] }
		]);
		expect(torch!.statChanges).toEqual([]);
	});
});

describe('export and import', () => {
	it('writes the Trench Companion layout and reads it back', async () => {
		const p = await player();
		let w = await p.make({ patronId: 'patron:the-keeper' });
		w = await roster.recruit(p.ctx(), w.id, { unitId: WARDEN, name: 'Old Marl' });
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		w = await roster.buy(p.ctx(), w.id, w.fighters[1]!.id, RIFLE);
		const text = (await warbands.exportOf(p.ctx(), w.id, 'text')).body;
		expect(text).toBe(
			[
				'## Lamp Wardens ##',
				'Faction: Lantern Guild',
				'Rating: 100 Ducats | 0 Glory',
				'Patron: The Keeper',
				'',
				'## Elites ##',
				'',
				'Warden - Old Marl',
				'• Cost: 60 Ducats | 0 Glory',
				'• Battlekit: Signal Lantern',
				'',
				'## Troops ##',
				'',
				'Torchbearer',
				'• Cost: 40 Ducats | 0 Glory',
				'• Battlekit: Hook Rifle',
				'',
				'## Stash ##',
				'Stashed Ducats: 600',
				'Unspent Glory: 0',
				''
			].join('\n')
		);
		const json = JSON.parse((await warbands.exportOf(p.ctx(), w.id, 'json')).body);
		expect(json).toMatchObject({ app: 'forgotten-letters-warband', version: 1 });
		const back = await warbands.importText(p.ctx(), { text });
		expect(back.unmatched).toEqual([]);
		expect(back.warband).toMatchObject({
			name: 'Lamp Wardens',
			patronName: 'The Keeper',
			stashDucats: 600,
			rating: { ducats: 100 }
		});
		await expect(
			warbands.importText(p.ctx(), { text: '## X ##\nFaction: Nobody' })
		).rejects.toMatchObject({ code: 'invalid', fields: { text: expect.any(String) } });
	});
});

describe('seats', () => {
	it('assigns to my seat; the CM reads it; leaving the seat lets it go', async () => {
		const p = await player();
		const { cm, campaign } = await seated(p);
		const w = await p.make();
		const v = await warbands.assignToSeat(p.ctx(), campaign.id, { warbandId: w.id });
		expect(v.seat).toMatchObject({ campaignId: campaign.id, allowBeyondLimits: false });
		const seen = await warbands.get(cm.ctx(), w.id);
		expect(seen.canEdit).toBe(false);
		await expect(roster.recruit(cm.ctx(), w.id, { unitId: TORCH })).rejects.toMatchObject({
			code: 'forbidden'
		});
		expect(await warbands.ofCampaign(cm.ctx(), campaign.id)).toMatchObject([
			{ warband: { id: w.id } }
		]);
		await expect(warbands.ofCampaign(p.ctx(), campaign.id)).rejects.toMatchObject({
			code: 'forbidden'
		});
		const [audit] =
			await sql()`select action from auth.audit_log where action = 'warband.assigned'`;
		expect(audit).toBeTruthy();
		await seats.leave(p.ctx(), campaign.id);
		expect((await warbands.get(p.ctx(), w.id)).seat).toBeNull();
		await expect(warbands.get(cm.ctx(), w.id)).rejects.toMatchObject({ code: 'not_found' });
	});
	it('refuses a warband in another campaign, and other rules unless re-checked', async () => {
		const p = await player();
		const one = await seated(p);
		const two = await seated(p);
		const w = await p.make();
		await warbands.assignToSeat(p.ctx(), one.campaign.id, { warbandId: w.id });
		await expect(
			warbands.assignToSeat(p.ctx(), two.campaign.id, { warbandId: w.id })
		).rejects.toMatchObject({ code: 'conflict', message: expect.stringMatching(/sits in/) });
		await warbands.clearSeat(p.ctx(), one.campaign.id);
		const old = await p.make({ rules: 'core-1.0.1' });
		await expect(
			warbands.assignToSeat(p.ctx(), two.campaign.id, { warbandId: old.id })
		).rejects.toMatchObject({ code: 'conflict', fields: { recheck: 'core-1.0.2' } });
		const moved = await warbands.assignToSeat(p.ctx(), two.campaign.id, {
			warbandId: old.id,
			recheck: true
		});
		expect(moved).toMatchObject({ rulesSet: 'core-1.0.2', seat: { campaignId: two.campaign.id } });
	});
	it('creates a warband from a seat with the campaign’s rules, in that seat', async () => {
		const p = await player();
		const { campaign } = await seated(p);
		const w = await p.make({ campaignId: campaign.id });
		expect(w.seat).toMatchObject({ campaignId: campaign.id });
	});
	it('a CM allowing beyond limits turns refusals into warnings', async () => {
		const p = await player();
		const { cm, campaign } = await seated(p);
		let w = await p.make({ ducatLimit: 60 });
		w = await roster.recruit(p.ctx(), w.id, { unitId: WARDEN });
		await warbands.assignToSeat(p.ctx(), campaign.id, { warbandId: w.id });
		await expect(roster.recruit(p.ctx(), w.id, { unitId: TORCH })).rejects.toMatchObject({
			code: 'conflict'
		});
		const c = await campaigns.get(cm.ctx(), campaign.id);
		await campaigns.update(
			cm.ctx(),
			campaign.id,
			campaignPatch.parse({
				name: c.name,
				visibility: c.visibility,
				version: c.version,
				allowBeyondLimits: 'true'
			})
		);
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		expect(w.rating.ducats).toBe(90);
		expect(w.issues.find((i) => i.code === 'ducat-limit')).toMatchObject({ severity: 'warning' });
	});
});

describe('campaign rules', () => {
	it('a CM picks another loaded core version, never an expansion or an unloaded one', async () => {
		const cm = await person('admin');
		const { campaign } = await newCampaign(cm, { kind: 'generic' });
		const save = async (rulesSet: string) => {
			const c = await campaigns.get(cm.ctx(), campaign.id);
			return campaigns.update(
				cm.ctx(),
				campaign.id,
				campaignPatch.parse({
					name: c.name,
					visibility: c.visibility,
					version: c.version,
					rulesSet
				})
			);
		};
		expect((await save('core-1.0.1')).rulesSet).toBe('core-1.0.1');
		await expect(save('mire-front-1.0')).rejects.toMatchObject({
			code: 'invalid',
			fields: { rulesSet: expect.any(String) }
		});
		await expect(save('core-9.9')).rejects.toMatchObject({ code: 'invalid' });
	});
	it('refuses another version while a seated warband plays this one, naming it', async () => {
		const p = await player();
		const { cm, campaign } = await seated(p);
		const w = await p.make();
		await warbands.assignToSeat(p.ctx(), campaign.id, { warbandId: w.id });
		const c = await campaigns.get(cm.ctx(), campaign.id);
		const patch = (rulesSet: string) =>
			campaignPatch.parse({ name: c.name, visibility: c.visibility, version: c.version, rulesSet });
		await expect(
			campaigns.update(cm.ctx(), campaign.id, patch('core-1.0.1'))
		).rejects.toMatchObject({
			code: 'conflict',
			fields: { rulesSet: expect.stringMatching(/^Lamp Wardens is built for other rules/) }
		});
		// The same version saves as before.
		expect((await campaigns.update(cm.ctx(), campaign.id, patch('core-1.0.2'))).rulesSet).toBe(
			'core-1.0.2'
		);
	});
});

describe('images and accounts', () => {
	it('stores a PNG as sent, refuses other files, serves it to who may see it, removes it with the fighter', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const fid = w.fighters[0]!.id;
		await expect(
			images.setImage(p.ctx(), w.id, fid, new TextEncoder().encode('GIF89a not this'))
		).rejects.toMatchObject({ code: 'invalid', fields: { image: expect.any(String) } });
		await expect(
			images.setImage(p.ctx(), w.id, fid, new Uint8Array(2 * 1024 * 1024 + 1))
		).rejects.toMatchObject({ code: 'invalid' });
		w = await images.setImage(p.ctx(), w.id, fid, PNG);
		expect(w.fighters[0]!.image).toMatch(new RegExp(`^/uploads/fighters/${fid}\\?v=`));
		const got = await images.image(p.ctx(), fid);
		expect(got.type).toBe('image/png');
		expect(new Uint8Array(got.bytes)).toEqual(PNG);
		const other = await person('user');
		await expect(images.image(other.ctx(), fid)).rejects.toMatchObject({ code: 'not_found' });
		const file = join(config().UPLOADS_DIR, 'fighters', w.id, fid);
		expect(existsSync(file)).toBe(true);
		await roster.removeFighter(p.ctx(), w.id, fid);
		expect(existsSync(file)).toBe(false);
	});
	it('anonymising an account removes its warbands', async () => {
		const owner = await person('owner');
		const p = await player();
		const w = await p.make();
		const disabled = await people.setDisabled(owner.ctx(), p.row.id, true, p.row.version);
		await people.anonymise(owner.ctx(), p.row.id, disabled.version);
		const [row] = await sql()`select count(*)::int as n from warband.warbands where id = ${w.id}`;
		expect(row!.n).toBe(0);
	});
});

describe('revision 2: the Arsenal, selling and campaign data', () => {
	it('sells at half (rounded up) after the first game; refuses a refund then; delete gives nothing', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const fid = w.fighters[0]!.id;
		w = await roster.buy(p.ctx(), w.id, fid, RIFLE);
		await roster.buy(p.ctx(), w.id, fid, SMOKE);
		w = await holdings.stashBuy(p.ctx(), w.id, 'line:lantern-guild/quilted-coat');
		expect(w).toMatchObject({ stashDucats: 640, canRefund: true });
		expect(w.fighters[0]!.kit.find((k) => k.lineId === RIFLE)).toMatchObject({
			price: { ducats: 10 },
			sell: { ducats: 5 }
		});
		w = await warbands.patch(p.ctx(), w.id, { version: w.version, gamesPlayed: 1 });
		expect(w).toMatchObject({ canRefund: false, gamesPlayed: 1 });
		await expect(items.leave(p.ctx(), w.id, fid, RIFLE, 'refund')).rejects.toMatchObject({
			code: 'conflict'
		});
		w = await items.leave(p.ctx(), w.id, fid, SMOKE, 'sell');
		expect(w.stashDucats).toBe(643); // 5 Ducats: 3 back
		w = await items.leave(p.ctx(), w.id, 'arsenal', 'line:lantern-guild/quilted-coat', 'sell');
		expect(w).toMatchObject({ stashDucats: 651, stash: [] }); // 15: 8 back
		w = await items.leave(p.ctx(), w.id, fid, RIFLE, 'delete');
		expect(w.stashDucats).toBe(651);
		await expect(roster.removeFighter(p.ctx(), w.id, fid, 'refund')).rejects.toMatchObject({
			code: 'conflict'
		});
		w = await roster.removeFighter(p.ctx(), w.id, fid, 'delete');
		expect(w).toMatchObject({ stashDucats: 651, fighters: [] });
	});
	it('moves kit between fighters and the Arsenal with no money; checks the fighter that takes it', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const [a, b] = w.fighters.map((x) => x.id);
		w = await roster.buy(p.ctx(), w.id, a!, SMOKE);
		const bank = w.stashDucats;
		w = await items.move(p.ctx(), w.id, SMOKE, a!, 'arsenal');
		expect(w).toMatchObject({ stashDucats: bank, stash: [{ lineId: SMOKE }] });
		w = await items.move(p.ctx(), w.id, SMOKE, 'arsenal', b!);
		expect(w.fighters[1]!.kit.map((k) => k.lineId)).toContain(SMOKE);
		w = await roster.buy(p.ctx(), w.id, a!, SMOKE);
		// One Smoke Pot per model: B cannot take a second.
		await expect(items.move(p.ctx(), w.id, SMOKE, a!, b!)).rejects.toMatchObject({
			code: 'conflict'
		});
		await expect(items.move(p.ctx(), w.id, RIFLE, a!, b!)).rejects.toMatchObject({
			code: 'not_found'
		});
	});
	it('statuses: unfit sends bought kit to the Arsenal and leaves the rating; dead is off the roster', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const x = w.fighters[0]!;
		w = await roster.buy(p.ctx(), w.id, x.id, RIFLE);
		w = await roster.editFighter(p.ctx(), w.id, x.id, {
			version: w.fighters[0]!.version,
			status: 'unfit',
			scars: 3
		});
		expect(w).toMatchObject({
			rating: { ducats: 0 },
			stash: [{ lineId: RIFLE }]
		});
		expect(w.fighters[0]).toMatchObject({ status: 'unfit', scars: 3 });
		expect(w.fighters[0]!.kit.filter((k) => !k.fixed)).toEqual([]);
		w = await roster.editFighter(p.ctx(), w.id, x.id, {
			version: w.fighters[0]!.version,
			status: 'active'
		});
		expect(w.rating.ducats).toBe(30);
	});
	it('promotes by the book and caps Limited Potential', async () => {
		const p = await player();
		let w = await p.make({ variantId: 'variant:lantern-guild/ash-wardens' });
		w = await roster.recruit(p.ctx(), w.id, { unitId: 'unit:lantern-guild/ash-warden' });
		const ash = w.fighters[0]!;
		expect(ash).toMatchObject({ xpMax: 7, promotion: null });
		await expect(
			roster.editFighter(p.ctx(), w.id, ash.id, { version: ash.version, xp: 8 })
		).rejects.toMatchObject({ code: 'conflict' });
		w = await roster.editFighter(p.ctx(), w.id, ash.id, {
			version: ash.version,
			group: 'elite',
			xp: 4
		});
		expect(w.fighters[0]).toMatchObject({ group: 'elite', xp: 4, advancementsDue: 2 });
		expect(w.elites).toBe(1);
		w = await warbands.patch(p.ctx(), w.id, { version: w.version, gamesPlayed: 2 });
		expect(w.nextGame).toEqual({ game: 3, threshold: 600, fieldStrength: 8 });
	});
	it('copies a fighter (paid) and a warband (no seat, same fighters)', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		w = await roster.buy(p.ctx(), w.id, w.fighters[0]!.id, RIFLE);
		w = await roster.copyFighter(p.ctx(), w.id, w.fighters[0]!.id);
		expect(w).toMatchObject({ stashDucats: 620, rating: { ducats: 80 } });
		expect(w.fighters[1]!.kit.map((k) => k.lineId)).toEqual([RIFLE]);
		const c = await warbands.copy(p.ctx(), w.id);
		expect(c).toMatchObject({ name: 'Lamp Wardens (copy)', seat: null, stashDucats: 620 });
		expect(c.fighters).toHaveLength(2);
		expect(c.id).not.toBe(w.id);
	});
	it('ignore limits turns refusals into warnings outside a campaign', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: WARDEN });
		await expect(roster.recruit(p.ctx(), w.id, { unitId: WARDEN })).rejects.toMatchObject({
			code: 'conflict'
		});
		w = await warbands.patch(p.ctx(), w.id, { version: w.version, ignoreLimits: true });
		w = await roster.recruit(p.ctx(), w.id, { unitId: WARDEN });
		expect(w.fighters).toHaveLength(2);
		expect(w.issues.length).toBeGreaterThan(0);
	});
	it('the Patron: the owner until the first game; then only the campaign master', async () => {
		const p = await player();
		const { cm, campaign } = await seated(p);
		let w = await warbands.create(
			p.ctx(),
			warbandCreate.parse({ name: 'Seated', factionId: LG, campaignId: campaign.id })
		);
		expect(w.canChangePatron).toBe(true);
		w = await warbands.patch(p.ctx(), w.id, { version: w.version, gamesPlayed: 1 });
		expect(w.canChangePatron).toBe(false);
		await expect(
			warbands.patch(p.ctx(), w.id, { version: w.version, patronId: null, name: 'x' })
		).resolves.toBeTruthy(); // unchanged Patron: fine
		w = await warbands.get(p.ctx(), w.id);
		await expect(
			warbands.patch(cm.ctx(), w.id, { version: w.version, name: 'CM rename' })
		).rejects.toMatchObject({ code: 'forbidden' });
		const asCm = await warbands.get(cm.ctx(), w.id);
		expect(asCm.canChangePatron).toBe(true);
	});
	it('imports our JSON export and refuses JSON that is not a warband', async () => {
		const p = await player();
		let w = await p.make();
		w = await roster.recruit(p.ctx(), w.id, { unitId: TORCH });
		const out = await warbands.exportOf(p.ctx(), w.id, 'json');
		const r = await warbands.importText(p.ctx(), {
			text: out.body,
			format: 'json',
			gamesPlayed: 2
		});
		expect(r.warband).toMatchObject({ factionId: LG, gamesPlayed: 2, canRefund: false });
		expect(r.warband.fighters).toHaveLength(1);
		await expect(
			warbands.importText(p.ctx(), { text: '{"app":"other"}', format: 'json' })
		).rejects.toMatchObject({ code: 'invalid' });
	});
});
