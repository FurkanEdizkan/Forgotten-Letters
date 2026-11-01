/**
 * What changed between two rules versions, compared by id: elements added, removed, and changed with each changed
 * field (`keywords.0.value: 2 → 3`). Used by Errata & FAQ and by a campaign's version upgrade later.
 */
import type { Element } from './elements';

export type Value = string | number | boolean | null;
export interface FieldChange {
	path: string;
	from: Value | undefined;
	to: Value | undefined;
}
export interface Diff {
	added: Pick<Element, 'id' | 'type' | 'name'>[];
	removed: Pick<Element, 'id' | 'type' | 'name'>[];
	changed: (Pick<Element, 'id' | 'type' | 'name'> & { fields: FieldChange[] })[];
}

/** Every leaf of a value by its dotted path. */
function leaves(v: unknown, path = '', out = new Map<string, Value>()): Map<string, Value> {
	if (Array.isArray(v)) v.forEach((x, i) => leaves(x, path ? `${path}.${i}` : String(i), out));
	else if (v && typeof v === 'object')
		for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, out);
	else out.set(path, (v ?? null) as Value);
	return out;
}

const head = ({ id, type, name }: Element) => ({ id, type, name });
const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
	a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export function diff(from: Element[], to: Element[]): Diff {
	const old = new Map(from.map((e) => [e.id, e]));
	const now = new Map(to.map((e) => [e.id, e]));
	const out: Diff = { added: [], removed: [], changed: [] };
	for (const e of to) {
		const was = old.get(e.id);
		if (!was) {
			out.added.push(head(e));
			continue;
		}
		const a = leaves(was.data);
		const b = leaves(e.data);
		const fields: FieldChange[] = [];
		for (const path of new Set([...a.keys(), ...b.keys()]))
			if (a.get(path) !== b.get(path)) fields.push({ path, from: a.get(path), to: b.get(path) });
		if (fields.length) out.changed.push({ ...head(e), fields });
	}
	for (const e of from) if (!now.has(e.id)) out.removed.push(head(e));
	out.added.sort(byName);
	out.removed.sort(byName);
	out.changed.sort(byName);
	return out;
}
