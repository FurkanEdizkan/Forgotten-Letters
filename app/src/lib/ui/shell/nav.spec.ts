import { describe, expect, it } from 'vitest';
import {
	HELP_LINKS,
	initialOf,
	isFullHeightPage,
	isHelpSlug,
	isUnder,
	panelOpenByDefault,
	PANEL_KEY,
	readPanelChoice,
	savePanelChoice,
	shellData
} from './nav';

/** A Map-backed stand-in for localStorage. */
function memory() {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v)
	};
}
const broken = {
	getItem: () => {
		throw new Error('SecurityError');
	},
	setItem: () => {
		throw new Error('QuotaExceededError');
	}
};

describe('panel default', () => {
	it('starts open on a full-HD window and closed on a laptop', () => {
		expect(panelOpenByDefault(1920)).toBe(true);
		expect(panelOpenByDefault(2560)).toBe(true);
		expect(panelOpenByDefault(1919)).toBe(false);
		expect(panelOpenByDefault(1366)).toBe(false);
	});
});

describe('remembered panel choice', () => {
	it('is kept and read back', () => {
		const s = memory();
		expect(readPanelChoice(() => s)).toBeNull();
		savePanelChoice(() => s, false);
		expect(s.data.get(PANEL_KEY)).toBe('closed');
		expect(readPanelChoice(() => s)).toBe(false);
		savePanelChoice(() => s, true);
		expect(readPanelChoice(() => s)).toBe(true);
	});
	it('counts as no choice when storage is missing, throws or holds something else', () => {
		expect(readPanelChoice(() => undefined)).toBeNull();
		expect(readPanelChoice(() => broken)).toBeNull();
		expect(
			readPanelChoice(() => {
				throw new Error('no access');
			})
		).toBeNull();
		const s = memory();
		s.setItem(PANEL_KEY, 'maybe');
		expect(readPanelChoice(() => s)).toBeNull();
		expect(() => savePanelChoice(() => broken, true)).not.toThrow();
	});
});

describe('help pages', () => {
	it('knows the eight slugs and nothing else', () => {
		for (const s of [
			'docs',
			'faq',
			'licence',
			'contact',
			'support',
			'privacy',
			'terms',
			'unofficial'
		])
			expect(isHelpSlug(s)).toBe(true);
		for (const s of ['', 'license', 'Docs', 'admin', '../owner']) expect(isHelpSlug(s)).toBe(false);
	});
	it('lists the panel links in the approved order, Docs left to the top bar', () => {
		expect(HELP_LINKS.map((l) => l.label)).toEqual([
			'FAQ',
			'Licence',
			'Contact',
			'Support us',
			'Privacy',
			'Terms',
			'Unofficial notice'
		]);
		expect(HELP_LINKS[1]!.path).toBe('/help/licence');
	});
});

describe('paths', () => {
	it('marks a link current on its page and below it, not on a lookalike', () => {
		expect(isUnder('/owner', '/owner')).toBe(true);
		expect(isUnder('/owner/invites', '/owner')).toBe(true);
		expect(isUnder('/ownerish', '/owner')).toBe(false);
	});
	it('keeps welcome, setup and sign-in outside the shell', () => {
		for (const p of ['/welcome', '/setup', '/login', '/login/x'])
			expect(isFullHeightPage(p)).toBe(true);
		for (const p of ['/', '/owner', '/help/faq', '/loginx', '/home'])
			expect(isFullHeightPage(p)).toBe(false);
	});
});

describe('shell data', () => {
	it('carries only what the shell needs, with the areas of the role', () => {
		const owner = shellData({
			id: 'u1',
			username: 'mira',
			displayName: 'Mira',
			role: 'owner',
			mustChangePassword: false,
			// Extra fields (like a session hash) must not leak through.
			...({ sessionHash: 'secret' } as object)
		});
		expect(owner.me).toEqual({
			id: 'u1',
			username: 'mira',
			displayName: 'Mira',
			role: 'owner',
			mustChangePassword: false
		});
		expect(owner.areas.map((a) => a.path)).toEqual(['/owner', '/admin', '/home']);
	});
	it('gives the initial of the display name', () => {
		expect(initialOf('mira')).toBe('M');
		expect(initialOf('  élise')).toBe('É');
		expect(initialOf('')).toBe('?');
	});
});
