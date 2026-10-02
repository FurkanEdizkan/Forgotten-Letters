import { describe, expect, it } from 'vitest';
import { advancementsOwed, applyReport, experienceOf, newReport, rollAdvancement, rollPromotionStep, rollTrauma, type UnitFacts } from './aftermath';
import { effectsOf, type CampaignTable, type Progression } from './progression';

// Made-up tables in the books' shapes.
const survival: CampaignTable = { id: 'survival', name: 'Survival', dice: 'D6', source: null, text: '', rows: [{ roll: '1-2', name: 'Dead', text: '', effects: { dead: true } }, { roll: '3-6', name: 'Survived', text: '' }] };
const trauma: CampaignTable = {
	id: 'trauma',
	name: 'Trauma',
	dice: 'D66',
	source: null,
	text: '',
	rows: [
		{ roll: '11-16', name: 'Dead', text: '', effects: { dead: true } },
		{ roll: '21-56', name: 'Lame', text: '', effects: { stats: { movement: -1 } } },
		{ roll: '61-65', name: 'Full Recovery', text: '' },
		{ roll: '66', name: 'Bitter Lessons', text: '', effects: { extra_xp: 'D3' } }
	]
};
const skills: CampaignTable = { id: 'skills-a', name: 'A', dice: '2D6', source: null, text: '', rows: [{ roll: '2-7', name: 'Brawler', text: '' }, { roll: '8-12', name: 'Fleet', text: '' }] };
const p: Progression = { advancementAt: [2, 4], promotion: { baseDice: 1, perGloriousDeed: 1, autoAfter: 5, maxElite: 6 }, advancement: { tablesToPick: 2, dice: '2D6' }, text: '' };
const unit = (id: string, over: Partial<UnitFacts> = {}): UnitFacts => ({ id, name: id, type: 'Trooper', category: 'troop', keywords: [], experience: 0, skills: [], injuries: [], advancementsMade: 0, noExperience: false, ...over });
const dice = (...xs: number[]) => () => xs.shift() ?? 1;

describe('the aftermath', () => {
	const units = [unit('sergeant', { category: 'elite', experience: 1 }), unit('a'), unit('b')];

	it('Troops roll to survive, ELITE models on the Trauma Table, each once', () => {
		const r = newReport(units);
		const [sergeant, a] = r.models.map((m) => ({ ...m, outOfAction: true }));
		expect(rollTrauma(a, { survival, trauma }, dice(2))).toMatchObject({ result: 'Dead', dead: true });
		const t = rollTrauma(sergeant, { survival, trauma }, dice(3, 4))!;
		expect(t).toMatchObject({ total: 34, result: 'Lame' });
		expect(rollTrauma({ ...sergeant, trauma: t }, { survival, trauma }, dice(1, 1))).toBeNull();
		expect(rollTrauma({ ...sergeant, outOfAction: false }, { survival, trauma }, dice(1, 1))).toBeNull();
	});

	it('promotes surviving Troops on a 6, with a die per Glorious Deed', () => {
		let r = newReport(units);
		r = { ...r, models: r.models.map((m) => (m.unitId === 'sergeant' ? { ...m, deeds: 1 } : m)) };
		const after = rollPromotionStep(r, p, 1, 0, dice(6, 3));
		expect(after.promotion.pool).toBe(2);
		expect(after.models.find((m) => m.unitId === 'a')).toMatchObject({ elite: true, promotion: { dice: [6], promoted: true } });
		expect(after.models.find((m) => m.unitId === 'b')?.elite).toBe(false);
		expect(rollPromotionStep(after, p, 1, 0, dice(6)).models).toEqual(after.models);
	});

	it('Experience: 1 for a surviving ELITE model, 2 with a Glorious Deed, none if it cannot gain any', () => {
		const [s] = newReport(units).models;
		expect(experienceOf(s, units[0], dice())).toBe(1);
		expect(experienceOf({ ...s, deeds: 2 }, units[0], dice())).toBe(2);
		expect(experienceOf({ ...s, trauma: { dice: [6, 6], total: 66, result: 'Bitter Lessons', text: '', extraXp: 'D3' } }, units[0], dice(5))).toBe(4);
		expect(experienceOf(s, { ...units[0], noExperience: true }, dice())).toBe(0);
		expect(experienceOf({ ...s, trauma: { dice: [1, 1], total: 11, result: 'Dead', text: '', dead: true } }, units[0], dice())).toBe(0);
	});

	it('an Advancement Roll at each Experience threshold, on the tables picked, and the result applied', () => {
		const [s] = newReport(units).models;
		const gained = { ...s, xp: 1 };
		expect(advancementsOwed(gained, units[0], p)).toBe(1);
		const adv = rollAdvancement([skills, { ...skills, id: 'skills-b' }], '2D6', [], [], dice(3, 3, 6, 6));
		expect(adv.rolls.map((r) => r.skill)).toEqual(['Brawler', 'Fleet']);
		const done = { ...gained, advancements: [{ ...adv, chosen: 'Fleet' }], trauma: { dice: [3, 4], total: 34, result: 'Lame', text: '' } };
		expect(advancementsOwed(done, units[0], p)).toBe(0);
		const [change] = applyReport({ ...newReport(units), models: [done] }, units);
		expect(change).toMatchObject({ experience: 2, skills: ['Fleet'], injuries: ['Lame'], category: 'elite', status: undefined });
	});

	it('a promoted Troop starts again at 0 Experience; the dead are marked dead', () => {
		const r = newReport(units);
		const a = { ...r.models[1], elite: true, promotion: { dice: [6], promoted: true }, xp: 1 };
		const b = { ...r.models[2], outOfAction: true, trauma: { dice: [1], total: 1, result: 'Dead', text: '', dead: true } };
		const out = applyReport({ ...r, models: [a, b] }, units);
		expect(out[0]).toMatchObject({ category: 'elite', experience: 1 });
		expect(out[1]).toMatchObject({ status: 'dead' });
	});
});

describe('scars, lost kit and skills that change the Campaign Phase', () => {
	const scars: CampaignTable = {
		id: 'trauma',
		name: 'Trauma',
		dice: 'D66',
		source: null,
		text: '',
		rows: [
			{ roll: '11-26', name: 'Wound', text: '', effects: { scar: true } },
			{ roll: '31-36', name: 'Robbed', text: '', effects: { lose_kit: true } },
			{ roll: '41-66', name: 'Full Recovery', text: '' }
		]
	};
	const luck: CampaignTable = { id: 'skills-x', name: 'X', dice: 'D6', source: null, text: '', rows: [{ roll: '1-6', name: 'War-Luck', text: '', effects: { extra_scars: 1 } }] };
	const vet = unit('vet', { category: 'elite', injuries: ['Wound', 'Wound'] });
	const hit = (result: string) => ({ ...newReport([vet]).models[0], outOfAction: true, trauma: { dice: [1, 1], total: 11, result, text: '' } });

	it('a third Battle Scar leaves the model Unfit for Duty; War-Luck allows one more', () => {
		expect(applyReport({ ...newReport([vet]), models: [hit('Wound')] }, [vet], [scars])[0]).toMatchObject({ status: 'retired', unfit: true });
		const lucky = { ...vet, skills: ['War-Luck'] };
		expect(applyReport({ ...newReport([lucky]), models: [hit('Wound')] }, [lucky], [scars, luck])[0]).toMatchObject({ status: undefined, unfit: false });
	});

	it('Robbed takes the kit, gives no scar; Full Recovery records nothing', () => {
		expect(applyReport({ ...newReport([vet]), models: [hit('Robbed')] }, [vet], [scars])[0]).toMatchObject({ injuries: ['Wound', 'Wound'], loseKit: true });
		expect(applyReport({ ...newReport([vet]), models: [hit('Full Recovery')] }, [vet], [scars])[0].injuries).toEqual(['Wound', 'Wound']);
	});

	const units = [unit('sergeant', { category: 'elite', experience: 1 }), unit('a'), unit('b')];
	it('Show Off adds a Promotion die', () => {
		const r = rollPromotionStep(newReport(units), p, 1, 0, dice(1, 1, 1), 1);
		expect(r.promotion.pool).toBe(2);
	});

	it('War Stories: +1 Experience to the other ELITE models', () => {
		const [s] = newReport(units).models;
		expect(experienceOf(s, units[0], dice(), 1)).toBe(2);
	});
});

describe('Head Wound', () => {
	it('an ELITE model that gains no Experience takes Promotion Dice; a 6 heals it, the scar stays', () => {
		const tables: CampaignTable[] = [{ id: 'trauma', name: 'T', dice: 'D6', source: null, text: '', rows: [{ roll: '1-6', name: 'Head Wound', text: '', effects: { scar: true, no_experience: true } }] }];
		const hurt = unit('hurt', { category: 'elite', injuries: ['Head Wound'], noExperience: true, experience: 3 });
		const r = rollPromotionStep(newReport([hurt]), p, 1, 0, dice(6), 0, ['hurt']);
		expect(r.models[0].promotion?.promoted).toBe(true);
		const [c] = applyReport(r, [hurt], tables);
		expect(c).toMatchObject({ category: 'elite', injuries: ['Head Wound (healed)'], experience: 3 });
		expect(effectsOf(c.injuries, tables)).toMatchObject({ noExperience: false, scars: 1 });
	});
});
