/**
 * Trench Companion text and JSON, and our own JSON, both ways.
 * Reused from archive/carcass-front-v1:app/src/lib/tc-import.spec.ts, rewritten to ids and the rules folder format.
 */
import { describe, expect, it } from 'vitest';
import { fromText, toText } from './text.ts';
import { fromJson, fromTcJson, toJson } from './json.ts';
import { resolveFaction } from './resolve.ts';
import { core, U } from './fixtures/core.ts';
import { elite, fighter, wb } from './fixtures/build.ts';
import type { WarbandState } from './types.ts';

const pilgrims = resolveFaction(core, 'faction:order', 'variant:order/pilgrims');
const a = elite(U('captain'), {
	name: 'Brother Ansel',
	kit: ['line:order/pistol', 'line:order/sword'],
	skills: ['skill:saint/melee'],
	injuries: ['table:trauma#5-6']
});
const b = fighter('unit:order/pilgrims/pilgrim', {
	kit: ['line:order/rifle'],
	upgrades: ['upgrade:order/guard']
});
const c = fighter('unit:mercenaries/sellsword');
const d = fighter(U('hound'), { group: 'dead', name: 'Rex' });
const state: WarbandState = wb([a, b, c, d], {
	name: 'The Grey Company',
	variantId: 'variant:order/pilgrims',
	patronId: 'patron:saint',
	stashDucats: 66,
	unspentGlory: 1,
	stash: ['line:order/knife', 'line:order/frag'],
	fireteams: [[a.id, b.id]],
	locations: [{ name: 'Old Chapel', note: 'Searched once\nHolds a well' }]
});

const EXPECTED = `## The Grey Company ##
Faction: Pilgrim Band
Rating: 95 Ducats | 2 Glory
Patron: Saint Tester, the Patient

## Elites ##

Captain - Brother Ansel
• Cost: 70 Ducats | 0 Glory
• Battlekit: Pistol, Sword
• Skills: Melee Procurement
• Injuries: Iron Grip

## Troops ##

Pilgrim
• Cost: 25 Ducats | 0 Glory
• Upgrades & Choices: Guard
• Battlekit: Rifle

## Mercenaries ##

Sellsword
• Cost: 0 Ducats | 2 Glory
• Battlekit: Teeth

## Dead ##

Hound - Rex
• Cost: 15 Ducats | 0 Glory
• Battlekit: Teeth

## Stash ##
Stashed Ducats: 66
Unspent Glory: 1
Knife, Frag

## Fireteams ##
Fireteam 1
• Captain - Brother Ansel
• Pilgrim

## Locations ##
Old Chapel
• Searched once
• Holds a well
`;

describe('the Trench Companion text export', () => {
	it('writes the Full layout', () => {
		expect(toText(state, pilgrims)).toBe(EXPECTED);
	});

	it('reads it back to the same warband', () => {
		const { state: back, unmatched } = fromText(toText(state, pilgrims), core);
		expect(unmatched).toEqual([]);
		const plain = (s: WarbandState) => ({
			...s,
			setId: '',
			ducatLimit: 0,
			fighters: s.fighters.map((x) => ({ ...x, id: '', paid: undefined })),
			fireteams: s.fireteams.map((t) => t.map((id) => s.fighters.findIndex((x) => x.id === id)))
		});
		expect(plain(back)).toEqual(plain(state));
		expect(back.ducatLimit).toBe(500);
		expect(back.fighters[0]?.paid).toEqual({ ducats: 70, glory: 0 });
	});

	it('lists fighters off the roster under Dead with their status, and reads the status back', () => {
		const order = resolveFaction(core, 'faction:order');
		const killed = fighter(U('trooper'), { name: 'Kell', status: 'dead' });
		const gone = fighter(U('trooper'), { name: 'Old Bram', status: 'retired' });
		const away = fighter(U('trooper'), { name: 'Pike', status: 'captured' });
		const text = toText(wb([fighter(U('captain')), killed, gone, away]), order);
		const dead = text.slice(text.indexOf('## Dead ##'));
		expect(dead).toContain('Trooper - Kell\n• Cost: 20 Ducats | 0 Glory\n• Status: Dead');
		expect(dead).toContain('• Status: Retired');
		expect(dead).not.toContain('Pike');
		expect(text).toContain('• Status: Captured');
		const back = fromText(text, core).state.fighters;
		expect(back.map((x) => [x.name, x.status ?? 'active'])).toEqual([
			[undefined, 'active'],
			['Pike', 'captured'],
			['Kell', 'dead'],
			['Old Bram', 'retired']
		]);
	});

	it("takes the text's rating as the ducat limit when it is above the starting Ducats", () => {
		const text =
			'Old Hands\nFaction: Order of Tests\nRating: 900 Ducats | 4 Glory\n\nElites\n\nCaptain\n• Cost: 60 Ducats | 0 Glory';
		expect(fromText(text, core).state.ducatLimit).toBe(900);
		expect(fromText(text.replace('900', '100'), core).state.ducatLimit).toBe(700);
	});

	it('reads Discord marks, "Name (Unit)" titles and costs on the title line; reports what does not match', () => {
		const text = `## **Lost Ones** ##\nFaction: Order of Tests\nRating: 1 Ducats | 0 Glory\nPatron: Saint Tester\n\n**Elites**\n\n**Ansel (Captain)**\n• Cost: 60 Ducats | 0 Glory\n• Battlekit: Pistol, Mystery Thing\n• Upgrades & Choices: Shiny Hat\n\nTroops\nTrooper - 20 D | 0 G\nGoblin\n\nStash\nStashed Ducats: 3\nUnspent Glory: 0\nBattlekit: Knife, Widget\n\n--- View online:\nhttps://example.invalid/warband/1`;
		const { state: s, unmatched } = fromText(text, core);
		expect(s).toMatchObject({
			name: 'Lost Ones',
			factionId: 'faction:order',
			patronId: 'patron:saint',
			stashDucats: 3,
			stash: ['line:order/knife']
		});
		expect(s.fighters.map((x) => [x.unitId, x.name, x.group])).toEqual([
			[U('captain'), 'Ansel', 'elite'],
			[U('trooper'), undefined, 'troop']
		]);
		expect(s.fighters[1]?.paid).toEqual({ ducats: 20, glory: 0 });
		expect(unmatched).toEqual([
			'Captain - Ansel: item Mystery Thing',
			'Captain - Ansel: upgrade Shiny Hat',
			'Fighter: Goblin',
			'Stash: item Widget'
		]);
	});

	it('refuses a faction it does not know, unless told which one to import into', () => {
		expect(() => fromText('X\nFaction: Nobody\nTroops\nTrooper', core)).toThrow(
			/No faction or variant/
		);
		expect(
			fromText('X\nFaction: Nobody\nTroops\nTrooper', core, { factionId: 'faction:order' }).state
				.fighters
		).toHaveLength(1);
	});
});

describe('JSON', () => {
	it('our own export round-trips and is checked on the way in', () => {
		const back = fromJson(toJson(state));
		expect(back).toEqual({ ok: true, state });
		expect(fromJson('{"app":"forgotten-letters-warband","version":2}')).toMatchObject({
			ok: false
		});
		expect(
			fromJson('{"app":"forgotten-letters-warband","version":1,"warband":{"setId":""}}')
		).toMatchObject({ ok: false });
		expect(fromJson('not json')).toEqual({ ok: false, error: 'That is not JSON.' });
	});

	it("reads Trench Companion's JSON", () => {
		const raw = {
			warband_data: JSON.stringify({
				name: 'J',
				faction: { faction_property: { object_id: 'fc_orderoftests_fv_pilgrimband' } },
				ducat_bank: 12,
				glory_bank: 2,
				models: [
					{
						model: {
							name: 'Captain',
							elite: true,
							experience: 3,
							equipment: [{ equipment: { name: 'Pistol' } }]
						},
						purchase: { purchaseid: 'p1' }
					},
					{ model: { name: 'Pilgrim', active: 'dead' }, purchase: { purchaseid: 'p2' } }
				],
				equipment: [{ equipment: { name: 'Knife' } }],
				fireteams: [{ selections: [{ selection_ID: 'p1' }, { selection_ID: 'p2' }] }]
			})
		};
		const { state: s, unmatched } = fromTcJson(raw, core);
		expect(unmatched).toEqual([]);
		expect(s).toMatchObject({
			variantId: 'variant:order/pilgrims',
			stashDucats: 12,
			unspentGlory: 2,
			stash: ['line:order/knife']
		});
		expect(s.fighters.map((x) => [x.unitId, x.group, x.xp, x.kit])).toEqual([
			[U('captain'), 'elite', 3, ['line:order/pistol']],
			['unit:order/pilgrims/pilgrim', 'dead', 0, []]
		]);
		expect(s.fireteams).toEqual([['f1', 'f2']]);
		expect(() => fromTcJson({ nope: 1 }, core)).toThrow(/not a Trench Companion warband/);
	});
});
