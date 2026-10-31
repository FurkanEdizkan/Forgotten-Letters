import { describe, expect, it } from 'vitest';
import {
	blankValues,
	checkStep,
	firstBadStep,
	REVIEW,
	seatNames,
	stepForFields,
	type WizardValues
} from './wizard';

const filled = (over: Partial<WizardValues> = {}): WizardValues => ({
	...blankValues(),
	name: 'The Ashen Vigil',
	...over
});

describe('campaign wizard steps', () => {
	it('asks for a name on Basics and nothing else there', () => {
		expect(checkStep(0, blankValues())).toEqual({ name: 'Enter a name.' });
		expect(checkStep(0, filled())).toEqual({});
		expect(checkStep(1, blankValues())).toEqual({});
	});
	it('checks the schedule: game count range and dates in order', () => {
		expect(checkStep(1, filled({ gamesPerPlayer: '0' }))).toEqual({
			gamesPerPlayer: 'Use 1 to 50.'
		});
		expect(checkStep(1, filled({ gamesPerPlayer: '', startsOn: '', endsOn: '' }))).toEqual({});
		expect(checkStep(1, filled({ startsOn: '2026-11-03', endsOn: '2026-11-01' }))).toEqual({
			endsOn: 'The end is before the start.'
		});
	});
	it('keeps the seat count in 2 to 30', () => {
		expect(checkStep(2, filled({ seats: 1 }))).toEqual({ seats: 'Use 2 to 30 seats.' });
		expect(checkStep(2, filled({ seats: 30 }))).toEqual({});
	});
	it('keys house rule errors by row, on the House rules step', () => {
		const rules = [
			{ name: 'Night raids', text: '', on: true },
			{ name: '', text: '', on: false }
		];
		expect(checkStep(3, filled({ houseRules: rules }))).toEqual({
			'houseRules.1.name': 'Name the rule.'
		});
	});
	it('sends Create back to the earliest step with a problem', () => {
		expect(firstBadStep(filled())).toBeNull();
		expect(firstBadStep(filled({ seats: 40, name: '' }))?.step).toBe(0);
		expect(firstBadStep(filled({ seats: 40 }))).toEqual({
			step: 2,
			errors: { seats: 'Use 2 to 30 seats.' }
		});
		expect(checkStep(REVIEW, filled({ seats: 40 }))).toEqual({});
	});
	it('maps server field errors to their step', () => {
		expect(stepForFields({ name: 'That name is taken by another campaign. Try another.' })).toBe(0);
		expect(stepForFields({ 'houseRules.0.text': 'Use at most 500 characters.' })).toBe(3);
		expect(stepForFields({ _: 'Something' })).toBeNull();
	});
	it('names the seats it will make', () => {
		expect(seatNames(3)).toEqual(['Seat 1', 'Seat 2', 'Seat 3']);
	});
});
