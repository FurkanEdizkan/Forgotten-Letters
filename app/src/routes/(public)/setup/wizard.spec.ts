import { describe, expect, it } from 'vitest';
import { checkStep, firstBadStep, stepForFields, type WizardValues } from './wizard';

const good: WizardValues = {
	username: 'mira',
	displayName: 'Mira',
	password: 'a-long-enough-pass',
	repeat: 'a-long-enough-pass',
	textScale: 100,
	accent: 'blood'
};

describe('checkStep', () => {
	it('passes a complete Owner step', () => {
		expect(checkStep(0, good)).toEqual({});
	});

	it('says how short a short password is', () => {
		const e = checkStep(0, { ...good, password: 'short12', repeat: 'short12' });
		expect(e.password).toMatch(/at least 10 characters\. This one has 7\./);
	});

	it('refuses two different passwords', () => {
		expect(checkStep(0, { ...good, repeat: 'something-else' }).repeat).toBeTruthy();
	});

	it('checks the text size steps and the accent list', () => {
		expect(checkStep(1, { ...good, textScale: 112 }).textScale).toBeTruthy();
		expect(checkStep(1, { ...good, accent: 'teal' }).accent).toBeTruthy();
		expect(checkStep(1, { ...good, textScale: 115, accent: 'ash' })).toEqual({});
	});

	it('has nothing to check on the Done step', () => {
		expect(checkStep(2, good)).toEqual({});
	});
});

describe('firstBadStep and stepForFields', () => {
	it('finds the earliest step with a problem', () => {
		expect(firstBadStep(good, 2)).toBeNull();
		expect(firstBadStep({ ...good, accent: 'teal', username: '' }, 2)?.step).toBe(0);
		expect(firstBadStep({ ...good, accent: 'teal' }, 2)?.step).toBe(1);
	});

	it('maps server field errors back to their step', () => {
		expect(stepForFields({ username: 'That username is taken.' })).toBe(0);
		expect(stepForFields({ textScale: 'x', accent: 'x' })).toBe(1);
		expect(stepForFields({ port: 'not a wizard field' })).toBeNull();
		expect(stepForFields({})).toBeNull();
	});
});
