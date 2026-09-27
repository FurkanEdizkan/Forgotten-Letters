import { describe, expect, it } from 'vitest';
import { armouryCategory, builderWarnings, canTake, profileFor, recruitment } from './builder';

const P = [
	{ id: 'cap', name: 'Grave Captain', faction: 'x', availabilityMin: 1, availabilityMax: 1, keywords: ['ELITE', 'LEADER'] },
	{ id: 'vet', name: 'Mire Veteran', faction: 'x', availabilityMin: 0, availabilityMax: 2, keywords: ['ELITE'] },
	{ id: 'grunt', name: 'Ash Walker', faction: 'x', availabilityMin: 0, availabilityMax: null, keywords: [] }
];
const m = (id: string, type: string, extra: Partial<{ profileId: string | null; status: string }> = {}) => ({
	id,
	type,
	name: type,
	profileId: null,
	status: 'active',
	...extra
});

describe('warband builder', () => {
	it('finds a model’s profile by link, then by name', () => {
		expect(profileFor(m('1', 'renamed', { profileId: 'vet' }), P)?.id).toBe('vet');
		expect(profileFor(m('2', 'Ash-Walker'), P)?.id).toBe('grunt');
		expect(profileFor(m('3', 'Nobody'), P)).toBeNull();
		const thralls = [...P, { id: 'thr', name: 'Grail Thralls / Fly Thralls', faction: 'x', availabilityMin: 0, availabilityMax: null, keywords: [] }, { id: 'ber', name: 'Bereaved', faction: 'x', availabilityMin: 0, availabilityMax: null, keywords: [] }];
		expect(profileFor(m('4', 'Fly Thrall'), thralls)?.id).toBe('thr');
		expect(profileFor(m('5', 'Fly Bereaved'), thralls)?.id).toBe('ber');
		expect(profileFor(m('6', 'Walker'), P)?.id).toBe('grunt');
	});
	it('counts what is fielded and what is left', () => {
		const r = recruitment(P, [m('1', 'Mire Veteran'), m('2', 'Mire Veteran', { status: 'dead' }), m('3', 'Ash Walker')]);
		expect(r.find((x) => x.profile.id === 'vet')).toMatchObject({ fielded: 1, left: 1 });
		expect(r.find((x) => x.profile.id === 'grunt')).toMatchObject({ fielded: 1, left: null });
	});
	it('warns about leaders and limits', () => {
		expect(builderWarnings(P, [m('1', 'Ash Walker')])).toContain('The warband has no Leader.');
		const over = [m('1', 'Grave Captain'), m('2', 'Mire Veteran'), m('3', 'Mire Veteran'), m('4', 'Mire Veteran')];
		expect(builderWarnings(P, over)).toEqual(['3 Mire Veteran: the limit is 2.']);
	});
	it('files kit by armoury category and respects limits', () => {
		const armoury = [{ name: 'Gas Grenades', category: 'grenade' as const }];
		expect(armouryCategory({ name: 'Gas Grenades', kind: 'ranged' }, armoury)).toBe('grenade');
		expect(armouryCategory({ name: 'Rope', kind: 'equipment' }, armoury)).toBe('equipment');
		expect(canTake({ name: 'Trophy', limit: 1 }, [{ name: 'Trophy' }])).toBe(false);
		expect(canTake({ name: 'Trophy', limit: 2 }, [{ name: 'Trophy' }])).toBe(true);
	});
});
