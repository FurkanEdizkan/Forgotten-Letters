import { describe, expect, it } from 'vitest';
import { accent, ACCENTS, port, settingsPatch, setupInput, textScale } from './settings';

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

describe('port', () => {
	it('accepts 1024 to 65535', () => {
		for (const ok of [1024, 3000, '8080', 65535]) expect(port.safeParse(ok).success).toBe(true);
	});
	it('explains why low ports are refused', () => {
		expect(msg(port.safeParse(80))).toBe(
			'Port 1023 and below need admin rights. Pick 1024 or higher.'
		);
		expect(msg(port.safeParse(70000))).toBe('Ports stop at 65535.');
	});
});

describe('setupInput', () => {
	it('takes the Owner account plus look and port', () => {
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
			accent: 'brass',
			port: 3000
		});
	});
});

describe('settingsPatch', () => {
	it('needs at least one setting', () => {
		expect(msg(settingsPatch.safeParse({}))).toBe('Change at least one setting.');
		expect(settingsPatch.safeParse({ accent: 'ash' }).success).toBe(true);
	});
});
