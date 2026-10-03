/**
 * The Rules Editor's limit forms keep a limit as the pack writes it, plus what it counts (`mode`), so an empty
 * picker ("any item") stays what it counts. `toLimit` gives back the pack's shape: empty fields left out.
 */
import type { Limit } from './warband-limits';

export type Mode = 'items' | 'upgrades' | 'models' | 'entries' | 'warband_items';
export type EditLimit = Limit & { mode: Mode };

export const MODES: [Mode, string][] = [
	['items', 'each model’s kit'],
	['upgrades', 'each model’s upgrades'],
	['models', 'models in the warband'],
	['entries', 'different entries in the warband'],
	['warband_items', 'kit across the warband']
];

export const modeOf = (l: Limit): Mode => (l.items ? 'items' : l.upgrades ? 'upgrades' : l.entries ? 'entries' : l.warband_items ? 'warband_items' : 'models');

/** Empty strings, lists and objects, nulls, NaN and false left out, at every depth. */
export function clean<T>(v: T): T | undefined {
	if (v == null || v === '' || v === false || (typeof v === 'number' && Number.isNaN(v))) return undefined;
	if (Array.isArray(v)) {
		const xs = v.map(clean).filter((x) => x !== undefined);
		return xs.length ? (xs as T) : undefined;
	}
	if (typeof v === 'object') {
		const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]).filter(([, x]) => x !== undefined));
		return Object.keys(o).length ? (o as T) : undefined;
	}
	return v;
}

export function toLimit({ mode, ...l }: EditLimit): Limit {
	const out = (clean({ ...l, items: undefined, upgrades: undefined, models: undefined, entries: undefined, warband_items: undefined, per: undefined }) ?? {}) as Limit;
	const empty = mode === 'upgrades' || mode === 'entries' ? [] : {};
	(out as Record<string, unknown>)[mode] = clean(l[mode]) ?? empty;
	if (mode !== 'items' && mode !== 'upgrades') delete out.who;
	if (mode !== 'items') delete out.count;
	if (l.per) out.per = { ...(clean(l.per) ?? {}), ...(l.per.items ? { items: clean(l.per.items) ?? {} } : { models: clean(l.per.models) ?? {} }) };
	return out;
}
