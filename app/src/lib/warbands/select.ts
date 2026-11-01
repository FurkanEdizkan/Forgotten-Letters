/**
 * Selectors (docs/packs/LIMITS.md): which kit (`ItemSel`) and which models (`ModelSel`) a limit, price or stipulation
 * is about. Every key given must hold; within a key, any of the listed ids. Kit is priced and filed as in the
 * armoury (its line's price, not what was paid).
 *
 * Reused from archive/carcass-front-v1:app/src/lib/warband-limits.ts (matchItem, matchModel, upgradeIs), rewritten
 * to ids and the rules folder format.
 */
import type { ItemSel, ModelSel, Upgrade } from '../rules/pack.ts';
import { valueOf, type Carried, type Model } from './model.ts';
import { isEl, type Resolved } from './resolve.ts';
import { letters, type Options, type WarbandState } from './types.ts';

export interface Ctx {
	f: Resolved;
	state: WarbandState;
	opts?: Options;
}

export function matchItem(c: Carried, sel: ItemSel | undefined): boolean {
	if (!sel) return true;
	if (sel.items && !sel.items.includes(c.item.id)) return false;
	if (sel.categories && !sel.categories.includes(c.item.category)) return false;
	if (sel.types && !sel.types.includes(c.item.type)) return false;
	if (sel.keywords && !sel.keywords.some((k) => c.kws.includes(k))) return false;
	const cost = c.line?.cost ?? 0;
	if (sel.minCost != null && cost < sel.minCost) return false;
	if (sel.maxCost != null && cost > sel.maxCost) return false;
	if (sel.currency && (c.line?.currency ?? 'ducats') !== sel.currency) return false;
	if (sel.not && matchItem(c, sel.not)) return false;
	return true;
}

/** Does an upgrade answer to `x`: its id, its group ("Goetic Power"), or a keyword it grants? */
export const upgradeIs = (f: Resolved, u: Upgrade, x: string) =>
	isEl(f, x, u) ||
	(!!u.group && letters(u.group) === letters(x)) ||
	!!u.keywords?.some((k) => k.kw === x);

export function matchModel(m: Model, sel: ModelSel | undefined, ctx: Ctx): boolean {
	if (!sel) return true;
	if (sel.units && !sel.units.some((u) => isEl(ctx.f, u, m.unit))) return false;
	if (sel.keywords && !sel.keywords.some((k) => m.keywords.has(k))) return false;
	if (sel.upgrades && !sel.upgrades.some((x) => m.upgrades.some((u) => upgradeIs(ctx.f, u, x))))
		return false;
	if (sel.skills && !sel.skills.some((s) => m.skills.includes(s))) return false;
	if (sel.holding && !m.items.some((c) => matchItem(c, sel.holding))) return false;
	if (sel.category && !sel.category.includes(m.category)) return false;
	if (sel.valueUnder != null && !(valueOf(m, ctx.state, ctx.opts) < sel.valueUnder)) return false;
	if (sel.baseOver != null && !((m.base ?? 0) > sel.baseOver)) return false;
	if (sel.not && matchModel(m, sel.not, ctx)) return false;
	if (sel.any && !sel.any.some((s) => matchModel(m, s, ctx))) return false;
	return true;
}

/** The names a one-key selector lists (`any` of such selectors included), or null for anything richer. */
function onlyNames(sel: ModelSel, name: (id: string) => string): string[] | null {
	const keys = (Object.keys(sel) as (keyof ModelSel)[]).filter((k) => sel[k] !== undefined);
	if (keys.length !== 1) return null;
	if (sel.any) {
		const parts = sel.any.map((s) => onlyNames(s, name));
		return parts.every((p) => p) ? (parts as string[][]).flat() : null;
	}
	if (sel.holding)
		return Object.keys(sel.holding).length === 1 && sel.holding.items
			? sel.holding.items.map(name)
			: null;
	if (sel.category) return sel.category.map((c) => c.toUpperCase());
	const ids = sel.units ?? sel.upgrades ?? sel.keywords;
	return ids ? ids.map(name) : null;
}

/** "Lieutenant or ELITE only": the names an `only` selector lists; a selector with more in it, described whole. */
export function onlyPhrase(sel: ModelSel, f: Resolved, describe: (s: ModelSel) => string): string {
	const name = (id: string) =>
		f.idx.upgrades.get(id)?.name ??
		f.idx.units.get(id)?.name ??
		f.idx.keywords.get(id)?.name ??
		f.idx.items.get(id)?.name ??
		id;
	const names = onlyNames(sel, name)?.filter((x, i, all) => all.indexOf(x) === i);
	return names?.length ? `${names.join(' or ')} only` : `${describe(sel)} only`;
}
