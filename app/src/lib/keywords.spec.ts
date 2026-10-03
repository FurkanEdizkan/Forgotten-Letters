import { describe, expect, it } from 'vitest';
import { explain, keywordKey } from './keywords';

// Made-up glossary texts in the books' shapes.
const names: Record<string, string> = {
	'IGNORE [MODIFIER]': 'Ignore the named modifier.',
	'NEGATE [KEYWORD]': 'Not affected by the named keyword.',
	'IGNORE ARMOUR': 'Armour does not count.',
	GAS: 'Gas hurts.',
	'BLAST (X")': 'Hits around.',
	'+/- INJURY DICE': 'More or fewer injury dice.',
	'OFF-HAND': 'Second weapon penalty.'
};
const glossary = Object.fromEntries(Object.entries(names).map(([k, v]) => [keywordKey(k), v]));

describe('keyword explanations', () => {
	it('find the keyword itself, a parametrised one, and a family entry', () => {
		expect(explain(glossary, 'IGNORE ARMOUR')).toBe('Armour does not count.');
		expect(explain(glossary, 'BLAST 3"')).toBe('Hits around.');
		expect(explain(glossary, '+1 INJURY DICE')).toBe('More or fewer injury dice.');
		expect(explain(glossary, 'IGNORE COVER')).toBe('Ignore the named modifier.');
		expect(explain(glossary, 'IGNORES COVER')).toBe('Ignore the named modifier.');
		expect(explain(glossary, 'IGNORE LONG RANGE')).toBe('Ignore the named modifier.');
	});
	it('NEGATE X (and IGNORE X) says what X is', () => {
		expect(explain(glossary, 'NEGATE GAS')).toBe('Not affected by the named keyword.\n\nGAS: Gas hurts.');
		expect(explain(glossary, 'NEGATE FEAR')).toBe('Not affected by the named keyword.');
	});
	it('the books\' variants of a name', () => {
		expect(explain(glossary, 'IGNORE OFF-HAND WEAPON')).toBe('Ignore the named modifier.\n\nOFF HAND: Second weapon penalty.');
		expect(explain(glossary, 'UNKNOWN THING')).toBeNull();
	});
});
