/**
 * Keywords as players read them: a keyword with its value ("AUTOMATIC 2", "BLAST 3\"", "NEGATE FEAR"), and what it
 * means. A keyword that takes another keyword (NEGATE, IGNORE) also explains that one, so the reader sees what is
 * negated or ignored.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/keywords.ts, rewritten to ids and the rules folder format.
 */
import type { RulesSet } from '../rules/pack.ts';
import type { KwRef } from './model.ts';

/** The keyword as printed with its value: "NEGATE FEAR", "AUTOMATIC 2". */
export function keywordLabel(set: Pick<RulesSet, 'keywords'>, ref: KwRef): string {
	const k = set.keywords.find((x) => x.id === ref.kw);
	const name = k?.name ?? ref.kw.replace(/^kw:/, '').toUpperCase();
	if (ref.value == null) return name;
	const target = set.keywords.find((x) => x.id === ref.value);
	const value = target?.name ?? String(ref.value);
	return `${name} ${k?.param === 'X"' && !/"$/.test(value) ? `${value}"` : value}`;
}

/** What a keyword means: its own text, then (for a keyword about a keyword) the other keyword's. Null if unknown. */
export function explain(set: Pick<RulesSet, 'keywords'>, ref: KwRef): string | null {
	const k = set.keywords.find((x) => x.id === ref.kw);
	if (!k) return null;
	const target =
		typeof ref.value === 'string' ? set.keywords.find((x) => x.id === ref.value) : undefined;
	return target ? `${k.text}\n\n${target.name}: ${target.text}` : k.text;
}
