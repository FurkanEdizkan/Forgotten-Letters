import { describe, expect, it } from 'vitest';
import { campaignCreate, campaignPatch, houseRules, seatAcceptInput, seatPatch } from './campaigns';

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
	r.error?.issues[0]?.message;

const base = { name: 'The Ashen Vigil', kind: 'carcass_front', visibility: 'listed', seats: 8 };

describe('campaignCreate', () => {
	it('accepts the wizard as forms send it, empty optional fields included', () => {
		const v = campaignCreate.parse({
			...base,
			seats: '8',
			gamesPerPlayer: '',
			startsOn: '',
			endsOn: '',
			description: ''
		});
		expect(v).toMatchObject({
			seats: 8,
			gamesPerPlayer: undefined,
			startsOn: undefined,
			houseRules: []
		});
	});

	it('keeps seats within 2 to 30 (decision 5)', () => {
		expect(msg(campaignCreate.safeParse({ ...base, seats: 1 }))).toBe('Use 2 to 30 seats.');
		expect(msg(campaignCreate.safeParse({ ...base, seats: 31 }))).toBe('Use 2 to 30 seats.');
		expect(campaignCreate.safeParse({ ...base, seats: 30 }).success).toBe(true);
	});

	it('refuses an end before the start, on the end date field', () => {
		const r = campaignCreate.safeParse({ ...base, startsOn: '2026-11-03', endsOn: '2026-11-01' });
		expect(msg(r)).toBe('The end is before the start.');
		expect(r.error?.issues[0]?.path).toEqual(['endsOn']);
	});

	it('limits games per player to 1 to 50 and the name to 80 characters', () => {
		expect(msg(campaignCreate.safeParse({ ...base, gamesPerPlayer: 0 }))).toBe('Use 1 to 50.');
		expect(msg(campaignCreate.safeParse({ ...base, name: 'x'.repeat(81) }))).toBe(
			'Use at most 80 characters.'
		);
		expect(msg(campaignCreate.safeParse({ ...base, name: '   ' }))).toBe('Enter a name.');
	});
});

describe('house rules', () => {
	it('takes at most 30 named rules of up to 500 characters', () => {
		const rule = { name: 'Night raids', text: 'One extra game at night.', on: true };
		expect(houseRules.safeParse(Array(30).fill(rule)).success).toBe(true);
		expect(msg(houseRules.safeParse(Array(31).fill(rule)))).toBe('Use at most 30 house rules.');
		expect(msg(houseRules.safeParse([{ ...rule, name: '' }]))).toBe('Name the rule.');
		expect(msg(houseRules.safeParse([{ ...rule, text: 'x'.repeat(501) }]))).toBe(
			'Use at most 500 characters.'
		);
	});
});

describe('patches and seat links', () => {
	it('needs a version on campaign settings and has no type', () => {
		expect(campaignPatch.safeParse({ name: 'X', visibility: 'private' }).success).toBe(false);
		expect(
			campaignPatch.parse({ name: 'X', visibility: 'private', version: 2, kind: 'generic' })
		).not.toHaveProperty('kind');
	});
	it('reads "allow beyond limits" from a form (hidden false, then the box) or JSON', () => {
		const base = { name: 'X', visibility: 'private', version: 2 };
		expect(campaignPatch.parse({ ...base, allowBeyondLimits: 'on' }).allowBeyondLimits).toBe(true);
		expect(campaignPatch.parse({ ...base, allowBeyondLimits: 'false' }).allowBeyondLimits).toBe(
			false
		);
		expect(campaignPatch.parse({ ...base, allowBeyondLimits: true }).allowBeyondLimits).toBe(true);
		expect(campaignPatch.parse(base).allowBeyondLimits).toBeUndefined();
		expect(campaignPatch.safeParse({ ...base, rulesSet: 'Core 1' }).success).toBe(false);
	});

	it('changes a seat by name or frees it', () => {
		expect(seatPatch.safeParse({ version: 1 }).success).toBe(false);
		expect(seatPatch.safeParse({ version: 1, free: true }).success).toBe(true);
		expect(seatPatch.safeParse({ version: 1, name: 'Rear guard' }).success).toBe(true);
	});

	it('takes a seat signed in (nothing) or with a new account', () => {
		expect(seatAcceptInput.safeParse({}).success).toBe(true);
		expect(
			seatAcceptInput.safeParse({
				username: 'brigid',
				displayName: 'Brigid',
				password: 'long enough pw'
			}).success
		).toBe(true);
		expect(seatAcceptInput.safeParse({ username: 'brigid' }).success).toBe(false);
	});
});
