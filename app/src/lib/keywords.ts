/**
 * Glossary lookup: "BLESSED (3)" and "AUTOMATIC (X)" both find their base keyword; a family entry such as
 * "IGNORE [MODIFIER]" or "NEGATE [KEYWORD]" is filed under its first word.
 */
export const keywordKey = (k: string) =>
	k
		.toUpperCase()
		.replace(/\([^)]*\)|\[[^\]]*\]/g, '')
		.replace(/[^A-Z ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		// The books' own variants of a name.
		.replace(/^IGNORES\b/, 'IGNORE')
		.replace(/\bOFF HAND WEAPON\b/, 'OFF HAND');

/**
 * What a keyword means: its own entry, else its family's ("IGNORE COVER" → IGNORE [MODIFIER]); for NEGATE X the
 * text of X follows (IGNORE X too), so the reader sees what is negated or ignored. Null when the glossary has nothing for it.
 */
export function explain(glossary: Record<string, string>, keyword: string): string | null {
	const key = keywordKey(keyword);
	if (glossary[key]) return glossary[key];
	const [head, ...rest] = key.split(' ');
	const family = rest.length ? glossary[head] : undefined;
	if (!family) return null;
	const target = glossary[rest.join(' ')];
	return target ? `${family}\n\n${rest.join(' ')}: ${target}` : family;
}
