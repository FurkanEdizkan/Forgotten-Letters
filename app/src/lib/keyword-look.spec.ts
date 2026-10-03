import { describe, expect, it } from 'vitest';
import { lookOf, titleCase } from './keyword-look';

describe('how a keyword chip looks', () => {
	it('reads the kind from the name, families and modifiers included', () => {
		expect(lookOf('+1 DICE')).toBe('bonus');
		expect(lookOf('-2 INJURY MODIFIER')).toBe('bonus');
		expect(lookOf('BLAST 3"')).toBe('attack');
		expect(lookOf('IGNORE COVER')).toBe('attack');
		expect(lookOf('HEAVY')).toBe('kit');
		expect(lookOf('BLOOD MARKER')).toBe('harm');
		expect(lookOf('NEGATE FEAR')).toBe('body');
		expect(lookOf('DIFFICULT TERRAIN')).toBe('ground');
		expect(lookOf('NEW ANTIOCH')).toBe('tag');
	});
	it("takes the library's choice first", () => {
		expect(lookOf('ELITE', { ELITE: 'body' })).toBe('body');
		expect(lookOf('HEAVY', { HEAVY: 'nonsense' })).toBe('kit');
	});
	it('writes chips in title case', () => {
		expect(titleCase('IGNORE COVER')).toBe('Ignore Cover');
		expect(titleCase('BLAST 3"')).toBe('Blast 3"');
		expect(titleCase('+1 DICE')).toBe('+1 Dice');
		expect(titleCase('AMMUNITION (FIRE)')).toBe('Ammunition (Fire)');
	});
});
