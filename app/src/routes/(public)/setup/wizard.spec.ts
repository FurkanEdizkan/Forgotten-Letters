import { describe, expect, it } from 'vitest';
import {
	addressWithPort,
	checkStep,
	firstBadStep,
	stepForFields,
	type WizardValues
} from './wizard';

const good: WizardValues = {
	username: 'mira',
	displayName: 'Mira',
	password: 'a-long-enough-pass',
	repeat: 'a-long-enough-pass',
	textScale: 100,
	accent: 'blood',
	port: '3000'
};

describe('checkStep', () => {
	it('passes a complete Owner step', () => {
		expect(checkStep(0, good, false)).toEqual({});
	});

	it('says how short a short password is', () => {
		const e = checkStep(0, { ...good, password: 'short12', repeat: 'short12' }, false);
		expect(e.password).toMatch(/at least 10 characters\. This one has 7\./);
	});

	it('refuses two different passwords', () => {
		expect(checkStep(0, { ...good, repeat: 'something-else' }, false).repeat).toBeTruthy();
	});

	it('checks the text size steps and the accent list', () => {
		expect(checkStep(1, { ...good, textScale: 112 }, false).textScale).toBeTruthy();
		expect(checkStep(1, { ...good, accent: 'teal' }, false).accent).toBeTruthy();
		expect(checkStep(1, { ...good, textScale: 115, accent: 'ash' }, false)).toEqual({});
	});

	it('refuses a port below 1024 with the reason, unless the port is locked', () => {
		expect(checkStep(2, { ...good, port: '80' }, false).port).toMatch(/admin rights/);
		expect(checkStep(2, { ...good, port: '80' }, true)).toEqual({});
	});
});

describe('firstBadStep and stepForFields', () => {
	it('finds the earliest step with a problem', () => {
		expect(firstBadStep(good, false, 3)).toBeNull();
		expect(firstBadStep({ ...good, port: 'x', username: '' }, false, 3)?.step).toBe(0);
		expect(firstBadStep({ ...good, port: 'x' }, false, 3)?.step).toBe(2);
	});

	it('maps server field errors back to their step', () => {
		expect(stepForFields({ username: 'That username is taken.' })).toBe(0);
		expect(stepForFields({ port: 'In use', accent: 'x' })).toBe(1);
		expect(stepForFields({})).toBeNull();
	});
});

describe('addressWithPort', () => {
	it('puts the typed port into the address', () => {
		expect(addressWithPort('http://192.168.1.20:3000', '8080', false)).toBe(
			'http://192.168.1.20:8080'
		);
		expect(addressWithPort('http://[::1]:3000', '4000', false)).toBe('http://[::1]:4000');
	});

	it('keeps the address when the port is locked or invalid', () => {
		expect(addressWithPort('http://192.168.1.20:3000', '8080', true)).toBe(
			'http://192.168.1.20:3000'
		);
		expect(addressWithPort('http://192.168.1.20:3000', '80', false)).toBe(
			'http://192.168.1.20:3000'
		);
	});
});
