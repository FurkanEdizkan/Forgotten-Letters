import { describe, expect, it } from 'vitest';
import { accent, ACCENTS, settingsPatch, setupInput, textScale } from './settings';

const msg = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
	r.error?.issues[0]?.message;

describe('textScale', () => {
	it('accepts 90 to 130 in steps of 5, from forms as text too', () => {
		for (const ok of [90, 95, 100, 125, 130, '110'])
			expect(textScale.safeParse(ok).success).toBe(true);
	});
	it('refuses values outside the range or between steps', () => {
		expect(msg(textScale.safeParse(85))).toBe('Use 90 % or more.');
		expect(msg(textScale.safeParse(135))).toBe('Use 130 % or less.');
		expect(msg(textScale.safeParse(102))).toBe('Use steps of 5 %.');
	});
});

describe('accent', () => {
	it('accepts the five presets only', () => {
		for (const a of ACCENTS) expect(accent.safeParse(a).success).toBe(true);
		expect(msg(accent.safeParse('pink'))).toBe('Pick one of the colours.');
	});
});

describe('setupInput', () => {
	it('takes the Owner account plus the look; a port sent by an old client is dropped', () => {
		const r = setupInput.safeParse({
			username: 'Mira',
			displayName: 'Mira',
			password: 'a long password',
			textScale: '110',
			accent: 'brass',
			port: '3000'
		});
		expect(r.success && r.data).toEqual({
			username: 'mira',
			displayName: 'Mira',
			password: 'a long password',
			textScale: 110,
			accent: 'brass'
		});
	});
});

describe('settingsPatch', () => {
	it('needs at least one setting', () => {
		expect(msg(settingsPatch.safeParse({}))).toBe('Change at least one setting.');
		expect(settingsPatch.safeParse({ accent: 'ash' }).success).toBe(true);
	});
	it('refuses a port, which is picked when the app starts', () => {
		const r = settingsPatch.safeParse({ accent: 'ash', port: 3001 });
		expect(r.success).toBe(false);
		expect(r.error?.issues[0]).toMatchObject({
			path: ['port'],
			message: 'The port is picked when the app starts. Set PORTS in .env instead.'
		});
	});
	it('refuses any other unknown field', () => {
		expect(settingsPatch.safeParse({ accent: 'ash', colour: 'red' }).success).toBe(false);
	});
});
