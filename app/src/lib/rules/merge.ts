/**
 * A set over its base: what an expansion (or homebrew) plays as. Every list is the base's, with the set's elements
 * replacing base elements of the same id and its new ones added; the manifest is the set's own.
 */
import type { RulesSet } from './pack';

type Lists = Omit<RulesSet, 'manifest'>;

export function merge(base: RulesSet, set: RulesSet): RulesSet {
	const out = { manifest: set.manifest } as RulesSet;
	for (const key of Object.keys(set).filter((k) => k !== 'manifest') as (keyof Lists)[]) {
		const own = set[key] as { id?: string; name?: string }[];
		// Legal lists have no id: they are keyed by name.
		const keyOf = (x: { id?: string; name?: string }) => x.id ?? x.name;
		const replaced = new Set(own.map(keyOf));
		(out[key] as unknown[]) = [
			...(base[key] as { id?: string }[]).filter((x) => !replaced.has(keyOf(x))),
			...own
		];
	}
	return out;
}
