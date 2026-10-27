import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCENTS } from '#lib/schemas/settings';
import { ACCENT_COLOURS, contrast } from './accents';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** The custom properties declared in the first rule whose selector is exactly `selector`. */
function block(selector: string) {
	const at = css.indexOf(`${selector} {`);
	if (at < 0) return null;
	const body = css.slice(at, css.indexOf('}', at));
	return Object.fromEntries(
		[...body.matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]!.toLowerCase()])
	);
}

const root = block(':root')!;
const NIGHT = root['--night'];
const BONE = root['--bone'];

/**
 * Pairs below the 4.5:1 text target, measured and accepted. Each still passes 3:1 (large text and controls).
 * - blood bright: DESIGN.md §2 "Known misses": blood-bright is heading-size text and outlines only.
 * - brass base: a bone label on the brass fill (primary button) is 4.0:1; reported for a decision, not changed.
 */
const KNOWN_MISSES: Record<string, number> = {
	'blood bright on night': 4.02,
	'brass bone on base': 4.02
};

describe('accent presets', () => {
	it('declares every preset in tokens.css with the same values as accents.ts', () => {
		for (const a of ACCENTS) {
			const b = block(`:root[data-accent='${a}']`);
			expect(b, a).not.toBeNull();
			expect(b).toEqual({
				'--blood': ACCENT_COLOURS[a].base,
				'--blood-bright': ACCENT_COLOURS[a].bright,
				'--blood-pale': ACCENT_COLOURS[a].pale
			});
		}
	});

	it('keeps the default :root accent equal to blood', () => {
		expect(root['--blood']).toBe(ACCENT_COLOURS.blood.base);
		expect(root['--blood-bright']).toBe(ACCENT_COLOURS.blood.bright);
		expect(root['--blood-pale']).toBe(ACCENT_COLOURS.blood.pale);
	});

	describe.each(ACCENTS)('%s', (a) => {
		const c = ACCENT_COLOURS[a];
		const pairs: Array<[string, number]> = [
			[`${a} bright on night`, contrast(c.bright, NIGHT)],
			[`${a} pale on night`, contrast(c.pale, NIGHT)],
			[`${a} bone on base`, contrast(BONE, c.base)]
		];
		it.each(pairs)('%s meets WCAG AA text contrast (or is a recorded miss)', (name, ratio) => {
			const miss = KNOWN_MISSES[name];
			if (miss === undefined) expect(ratio).toBeGreaterThanOrEqual(4.5);
			else {
				// A recorded miss must not get worse, and must still pass the large-text target.
				expect(ratio).toBeCloseTo(miss, 2);
				expect(ratio).toBeGreaterThanOrEqual(3);
			}
		});
	});
});
