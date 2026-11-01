/**
 * The Rulebook's Battlekit Limits for one more piece of kit on a model: hands (two for ranged and two for melee
 * unless the entry or an upgrade gives more; a 2-Handed weapon takes two, a STRONG model holds a non-CUMBERSOME
 * one in one), a shield takes a hand and allows 2-Handed weapons only with Shield Combo, one grenade type, one
 * armour, one shield, one headgear, one HEAVY piece (unless STRONG), HELD kit, no duplicate equipment, a bayonet
 * needs a Bayonet Lug.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-rules.ts (equipCheck, handsUsed), rewritten to ids and
 * the rules folder format.
 */
import { ignoresHeavy } from './limits.ts';
import { handsOf, type Carried, type Model } from './model.ts';
import type { Concept } from './resolve.ts';
import type { Ctx } from './select.ts';
import { letters } from './types.ts';

type Flag = 'shieldCombo' | 'bayonetLug' | 'headgear' | 'consumable';
/** A stipulation flag, set on the armoury line (or the unit's own) or carried as a keyword. */
export const flag = (c: Carried, k: Flag & Concept, ctx: Ctx) =>
	!!c.stip[k] || c.kws.includes(ctx.f.kw[k]);

function used(items: Carried[], m: Model, ctx: Ctx) {
	const { kw } = ctx.f;
	const strong = m.keywords.has(kw.strong);
	let ranged = 0;
	let melee = 0;
	let shield: Carried | undefined;
	const twoHanded: Carried[] = [];
	for (const c of items) {
		const two = c.item.type === '2-Handed';
		if (c.item.category === 'shield') shield = c;
		if (c.item.category === 'ranged') {
			ranged += two ? 2 : 1;
			if (two) twoHanded.push(c);
		}
		if (c.item.category === 'melee') {
			const h = two && !(strong && !c.kws.includes(kw.cumbersome)) ? 2 : 1;
			melee += h;
			if (h === 2) twoHanded.push(c);
		}
	}
	const rangedTwo = twoHanded.some((c) => c.item.category === 'ranged');
	const meleeTwo = twoHanded.some((c) => c.item.category === 'melee');
	return { ranged, melee, shield, twoHanded, rangedTwo, meleeTwo };
}

const many = (n: number, what: string) => `${n === 1 ? 'one' : n} ${what}${n === 1 ? '' : 's'}`;

/** Why this model may not also carry `add` under the Battlekit Limits, or null. */
export function battlekitCheck(m: Model, add: Carried, ctx: Ctx): string | null {
	const { kw } = ctx.f;
	const cur = used(m.items, m, ctx);
	const items = [...m.items, add];
	const next = used(items, m, ctx);
	const hands = handsOf(m);
	const cat = add.item.category;
	if (cat === 'ranged' && next.ranged > hands.ranged)
		return `No free hands for a ranged weapon (${cur.ranged} of ${hands.ranged} in use)`;
	if (cat === 'melee' && next.melee > hands.melee)
		return `No free hands for a melee weapon (${cur.melee} of ${hands.melee} in use)`;
	const heavy = items.filter((c) => c.kws.includes(kw.heavy)).length;
	if (!ignoresHeavy(m, ctx) && heavy > Math.max(1, m.unit.kit.heavyOneHand ?? 0))
		return 'Only one piece of HEAVY battlekit';
	if (items.some((c) => c.kws.includes(kw.held))) {
		const held = (c: Carried) => c.kws.includes(kw.held);
		const other = items.filter(
			(c) => !held(c) && ['ranged', 'melee', 'shield'].includes(c.item.category)
		);
		if (other.length > 1) return 'With HELD battlekit, only one 1-Handed Weapon or a Shield';
		if (next.twoHanded.some((t) => !held(t))) return 'With HELD battlekit, no 2-Handed Weapons';
	}
	const shield = next.shield;
	if (shield) {
		const combo = flag(shield, 'shieldCombo', ctx);
		const bad = next.twoHanded.find((t) => !(combo && flag(t, 'shieldCombo', ctx)));
		if (bad) return `${bad.item.name} is 2-Handed and needs Shield Combo with ${shield.item.name}`;
		// The shield takes a hand: one 1-Handed weapon of each kind beside it (more with more hands).
		if (next.ranged > hands.ranged - 1 && !next.rangedTwo)
			return `With a Shield, only ${many(hands.ranged - 1, '1-Handed ranged weapon')}`;
		if (next.melee > hands.melee - 1 && !next.meleeTwo)
			return `With a Shield, only ${many(hands.melee - 1, '1-Handed melee weapon')}`;
	}
	const has = (c: string) => m.items.some((x) => x.item.category === c);
	if (cat === 'grenade' && has('grenade')) return 'Only one type of Grenade';
	if (cat === 'armour' && has('armour')) return 'Only one suit of Armour';
	if (cat === 'shield' && has('shield')) return 'Only one Shield';
	if (flag(add, 'headgear', ctx) && m.items.some((x) => flag(x, 'headgear', ctx)))
		return 'Only one piece of Headgear';
	// No two of the same piece of equipment, unless the line allows more on one model.
	if (
		(cat === 'equipment' || cat === 'special') &&
		!((add.stip.perModel ?? 1) > 1) &&
		m.items.some((x) => x.item.id === add.item.id)
	)
		return `Already has ${add.item.name}`;
	if (
		letters(add.item.name) === 'bayonet' &&
		!m.items.some((x) => x.item.category === 'ranged' && flag(x, 'bayonetLug', ctx))
	)
		return 'Needs a ranged weapon with a Bayonet Lug';
	return null;
}
