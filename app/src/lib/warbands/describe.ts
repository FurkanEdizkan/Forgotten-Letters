/**
 * Limits and selectors in plain words: what a broken limit with no text of its own says, and the homebrew editor's
 * preview ("Each model carries at most 2 HEAVY Ranged Weapons").
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-limits.ts (describeItems, describeModels,
 * describeLimit), rewritten to ids and the rules folder format.
 */
import type { ItemSel, Limit, ModelSel } from '../rules/pack.ts';
import { nameOf, type Resolved } from './resolve.ts';
import { coin } from './types.ts';

const CATEGORY_NAMES: Record<string, string> = {
	ranged: 'Ranged Weapons',
	grenade: 'Grenades',
	melee: 'Melee Weapons',
	armour: 'Armour',
	shield: 'Shields',
	equipment: 'Equipment',
	special: 'Special items'
};
const or = (xs: string[]) =>
	xs.length < 2 ? (xs[0] ?? '…') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;

/** "2-Handed HEAVY Melee Weapons costing 10 Ducats or less". */
export function describeItems(f: Resolved, s: ItemSel | undefined): string {
	if (!s) return 'items';
	const n = (ids: string[]) => ids.map((i) => nameOf(f, i));
	const noun = s.items
		? or(n(s.items))
		: s.categories?.length
			? or(s.categories.map((c) => CATEGORY_NAMES[c] ?? c))
			: 'items';
	const parts = [[...(s.types ?? []), ...n(s.keywords ?? []), noun].join(' ')];
	const c = coin(s.currency ?? 'ducats');
	if (s.minCost != null && s.maxCost != null) parts.push(`costing ${s.minCost}–${s.maxCost} ${c}`);
	else if (s.minCost != null) parts.push(`costing ${s.minCost} ${c} or more`);
	else if (s.maxCost != null) parts.push(`costing ${s.maxCost} ${c} or less`);
	else if (s.currency) parts.push(`paid in ${c}`);
	if (s.not) parts.push(`other than ${describeItems(f, s.not)}`);
	return parts.join(' ');
}

/** "Elite models with ARTILLERY, holding Rifles". */
export function describeModels(f: Resolved, s: ModelSel | undefined, noun = 'models'): string {
	if (!s) return noun;
	const n = (ids: string[]) => ids.map((i) => nameOf(f, i));
	const head = s.units
		? or(n(s.units))
		: [...(s.category ?? []).map((c) => c[0]!.toUpperCase() + c.slice(1)), noun].join(' ');
	const parts = [head];
	if (s.keywords?.length) parts.push(`with ${or(n(s.keywords))}`);
	if (s.upgrades?.length) parts.push(`with the upgrade ${or(n(s.upgrades))}`);
	if (s.skills?.length) parts.push(`with the Skill ${or(n(s.skills))}`);
	if (s.holding) parts.push(`holding ${describeItems(f, s.holding)}`);
	if (s.valueUnder != null) parts.push(`worth under ${s.valueUnder} Ducats`);
	if (s.baseOver != null) parts.push(`on a base over ${s.baseOver}mm`);
	if (s.not) parts.push(`but not ${describeModels(f, s.not)}`);
	if (s.any) parts.push(`that are ${s.any.map((x) => describeModels(f, x)).join(' or ')}`);
	return parts.join(', ');
}

/** A limit in plain words, ending in a full stop. */
export function describeLimit(f: Resolved, l: Limit): string {
	const amount =
		l.min != null && l.max != null
			? l.min === l.max
				? `exactly ${l.min}`
				: `${l.min}–${l.max}`
			: l.max === 0
				? 'no'
				: l.max != null
					? `at most ${l.max}`
					: `at least ${l.min ?? 0}`;
	let s: string;
	if (l.items || l.upgrades) {
		const who = l.who ? `Each of ${describeModels(f, l.who)}` : 'Each model';
		s = l.items
			? `${who} carries ${amount} ${describeItems(f, l.items)}${l.count === 'weapons' ? ' (counted as weapons: a 2-Handed one is two)' : ''}`
			: `${who} has ${amount} of the upgrades ${or(l.upgrades!.map((i) => nameOf(f, i)))}`;
	} else if (l.entries)
		s = `The warband has ${amount} of ${or(l.entries.map((i) => nameOf(f, i)))}`;
	else if (l.warbandItems) s = `The warband carries ${amount} ${describeItems(f, l.warbandItems)}`;
	else s = `The warband has ${amount} ${describeModels(f, l.models)}`;
	if (l.per && l.max != null) {
		const each = l.per.each && l.per.each > 1 ? `${l.per.each} ` : '';
		const what =
			l.per.models || !l.per.items
				? describeModels(f, l.per.models)
				: describeItems(f, l.per.items);
		s += ` for each ${each}${what}`;
		if (l.per.round === 'up') s += ' (a part counts)';
		if (l.per.strict) s += ', less one';
	}
	const c = l.when;
	if (c?.ratingMin != null) s += `, while its other models are worth ${c.ratingMin} Ducats or more`;
	if (c?.ratingUnder != null)
		s += `, while its other models are worth under ${c.ratingUnder} Ducats`;
	if (c?.present) s += `, while it has ${describeModels(f, c.present)}`;
	if (c?.absent) s += `, unless it has ${describeModels(f, c.absent)}`;
	if (c?.option) s += `, when ${c.option.key} is ${String(c.option.value)}`;
	return `${s}.`;
}
