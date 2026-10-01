/**
 * Patrons: the powers a warband serves (Rulebook, Carcass Front), each with its Skills, and who may take one.
 */
import { FACTIONS } from './rules/factions';

export interface Patron {
	id: string;
	name: string;
	/** Only warbands of this alignment; null: either. */
	alignment: 'faithful' | 'fallen' | null;
	/** Only these factions (ids); empty: any. */
	factions: string[];
	/** Only these variants, of the factions they belong to; a listed faction none of whose variants are named takes it whole. */
	variants: string[];
	text: string;
	skills: { name: string; text: string }[];
	source: string | null;
}

const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * May a warband of this faction and variant serve this Patron? The variants narrow only their own faction: Mammon is
 * any Heretic Legions warband's, or the Court's Greed warbands'.
 */
export function patronAllowed(p: Patron, w: { faction: string; variant: string | null; alignment: 'faithful' | 'fallen' | null }) {
	if (p.alignment && w.alignment && p.alignment !== w.alignment) return false;
	if (!p.factions.length) return true;
	if (!p.factions.includes(w.faction)) return false;
	const own = FACTIONS.find((f) => f.id === w.faction)?.variants ?? [];
	const named = p.variants.filter((v) => own.some((o) => letters(o) === letters(v)));
	return !named.length || (!!w.variant && named.some((v) => letters(v) === letters(w.variant!)));
}

/** The `patrons:` list of a book pack, checked; errors by path. */
export function readPatrons(input: unknown, err: (path: string, message: string) => void): Patron[] {
	if (input == null) return [];
	if (!Array.isArray(input)) {
		err('patrons', 'must be a list');
		return [];
	}
	const str = (v: unknown) => (v == null ? '' : String(v).trim());
	const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
	return input.flatMap((o: Record<string, unknown>, i) => {
		const name = str(o?.name);
		if (!name) {
			err(`patrons[${i}].name`, 'is required');
			return [];
		}
		const alignment = o.alignment == null ? null : str(o.alignment).toLowerCase();
		if (alignment && alignment !== 'faithful' && alignment !== 'fallen') err(`patrons[${i}].alignment`, 'must be faithful or fallen');
		const factions = list(o.factions);
		for (const f of factions) if (!FACTIONS.some((x) => x.id === f)) err(`patrons[${i}].factions`, `no faction "${f}"`);
		const skills = (Array.isArray(o.skills) ? o.skills : []).map((s: Record<string, unknown>) => ({ name: str(s?.name), text: str(s?.text) })).filter((s) => s.name);
		return [
			{
				id: slug(name),
				name,
				alignment: alignment === 'faithful' || alignment === 'fallen' ? alignment : null,
				factions,
				variants: list(o.variants),
				text: str(o.text),
				skills,
				source: str(o.source) || null
			}
		];
	});
}

/** The Patron a name means: exactly, else the one whose name starts with it (Trench Companion's "Blessed Bartolomeo"). */
export function findPatron<T extends { name: string }>(list: T[], name: string | null | undefined): T | null {
	const n = letters(name ?? '');
	if (!n) return null;
	return list.find((p) => letters(p.name) === n) ?? list.find((p) => letters(p.name).startsWith(n) || n.startsWith(letters(p.name))) ?? null;
}
