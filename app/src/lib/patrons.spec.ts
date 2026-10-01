import { describe, expect, it } from 'vitest';
import { findPatron, patronAllowed, readPatrons, type Patron } from './patrons';

const patron = (over: Partial<Patron>): Patron => ({ id: 'p', name: 'P', alignment: null, factions: [], variants: [], text: '', skills: [], source: null, ...over });

describe('who may serve a Patron', () => {
	it('by alignment', () => {
		const p = patron({ alignment: 'faithful' });
		expect(patronAllowed(p, { faction: 'new-antioch', variant: null, alignment: 'faithful' })).toBe(true);
		expect(patronAllowed(p, { faction: 'heretic-legions', variant: null, alignment: 'fallen' })).toBe(false);
	});
	it('by faction, with variants narrowing only their own faction', () => {
		// Mammon: any Heretic Legions warband, or the Court's Greed warbands.
		const mammon = patron({ factions: ['heretic-legions', 'seven-headed-serpent'], variants: ['Greed'] });
		expect(patronAllowed(mammon, { faction: 'heretic-legions', variant: null, alignment: 'fallen' })).toBe(true);
		expect(patronAllowed(mammon, { faction: 'heretic-legions', variant: 'Trench Ghosts', alignment: 'fallen' })).toBe(true);
		expect(patronAllowed(mammon, { faction: 'seven-headed-serpent', variant: 'Greed', alignment: 'fallen' })).toBe(true);
		expect(patronAllowed(mammon, { faction: 'seven-headed-serpent', variant: 'Wrath', alignment: 'fallen' })).toBe(false);
		expect(patronAllowed(mammon, { faction: 'seven-headed-serpent', variant: null, alignment: 'fallen' })).toBe(false);
		expect(patronAllowed(mammon, { faction: 'black-grail', variant: null, alignment: 'fallen' })).toBe(false);
	});
});

describe('reading Patrons from a pack', () => {
	it('checks names, alignments and factions', () => {
		const errors: string[] = [];
		const ps = readPatrons(
			[
				{ name: 'Saint', alignment: 'faithful', factions: ['new-antioch'], skills: [{ name: 'Blessing', text: 'Does good.' }] },
				{ name: '', text: 'x' },
				{ name: 'Odd', alignment: 'neutral', factions: ['nobody'] }
			],
			(p, m) => errors.push(`${p}: ${m}`)
		);
		expect(ps.map((p) => p.id)).toEqual(['saint', 'odd']);
		expect(ps[0].skills).toEqual([{ name: 'Blessing', text: 'Does good.' }]);
		expect(errors).toEqual(['patrons[1].name: is required', 'patrons[2].alignment: must be faithful or fallen', 'patrons[2].factions: no faction "nobody"']);
	});
});

describe('finding a Patron by name', () => {
	it('exactly, else by the start of its name', () => {
		const list = [{ name: 'Blessed Bartolomeo, the Martyr of Leviathan' }, { name: 'Mammon' }];
		expect(findPatron(list, 'Mammon')?.name).toBe('Mammon');
		expect(findPatron(list, 'Blessed Bartolomeo')?.name).toBe('Blessed Bartolomeo, the Martyr of Leviathan');
		expect(findPatron(list, 'Nobody')).toBeNull();
		expect(findPatron(list, '')).toBeNull();
	});
});
