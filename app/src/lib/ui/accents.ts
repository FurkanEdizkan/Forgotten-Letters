/**
 * The accent presets as values, for places that recolour before the setting is saved (the setup wizard's live
 * preview). tokens.css holds the same values under :root[data-accent=…]; accents.spec.ts keeps the two in step.
 */
import type { Accent } from '#lib/schemas/settings';

export type AccentColours = {
	/** The structural accent as a fill or a line (--blood). Never text. */
	base: string;
	/** The accent as heading-size text, outlines and focus rings (--blood-bright). */
	bright: string;
	/** The accent as small text (--blood-pale). */
	pale: string;
};

export const ACCENT_COLOURS: Record<Accent, AccentColours> = {
	blood: { base: '#a3170f', bright: '#d8392e', pale: '#d98c80' },
	brass: { base: '#8a6a1c', bright: '#d4a537', pale: '#e3c88a' },
	verdigris: { base: '#2f6f62', bright: '#4fb39c', pale: '#9fd3c4' },
	bruise: { base: '#5b3a7a', bright: '#a57ad1', pale: '#cbb3e6' },
	ash: { base: '#4d4a44', bright: '#b8b0a0', pale: '#d6cfc0' }
};

/** The accent tokens for a preset, as inline CSS custom properties for one subtree. */
export const accentVars = (accent: Accent) => {
	const c = ACCENT_COLOURS[accent];
	return `--blood: ${c.base}; --blood-bright: ${c.bright}; --blood-pale: ${c.pale};`;
};

/** WCAG 2 relative luminance of a #rrggbb colour. */
export function luminance(hex: string) {
	const lin = (i: number) => {
		const v = parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}

/** WCAG 2 contrast ratio between two #rrggbb colours (1 to 21). */
export function contrast(a: string, b: string) {
	const [x, y] = [luminance(a), luminance(b)];
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
