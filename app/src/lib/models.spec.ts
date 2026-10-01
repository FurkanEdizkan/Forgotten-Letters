import { describe, expect, it } from 'vitest';
import { looksLikeStl, outpostFrame, resolveTokens, type ModelRef } from './models';

const models: ModelRef[] = [
	{ kind: 'outpost', ownerType: 'faction', ownerId: 'iron-sultanate', token: '/f-out' },
	{ kind: 'figure', ownerType: 'faction', ownerId: 'iron-sultanate', token: '/f-fig' },
	{ kind: 'outpost', ownerType: 'warband', ownerId: 'w1', token: '/w-out' }
];

describe('model tokens', () => {
	it('prefers the warband model, then the faction default', () => {
		expect(resolveTokens(models, { id: 'w1', faction: 'iron-sultanate', displayModel: 'model' })).toEqual({
			outpostToken: '/w-out',
			figureToken: '/f-fig',
			leaderToken: '/f-fig'
		});
		expect(resolveTokens(models, { id: 'w2', faction: 'iron-sultanate', displayModel: 'portrait' })).toEqual({
			outpostToken: '/f-out',
			figureToken: null,
			// The banner's leader stands whatever the marker shows.
			leaderToken: '/f-fig'
		});
		expect(resolveTokens(models, { id: 'w3', faction: 'black-grail', displayModel: 'model' })).toEqual({
			outpostToken: null,
			figureToken: null,
			leaderToken: null
		});
	});

	it('stands the leader model at the banner: the warband\'s, the faction\'s, then the figure', () => {
		const withLeaders: ModelRef[] = [
			...models,
			{ kind: 'leader', ownerType: 'faction', ownerId: 'iron-sultanate', token: '/f-lead' },
			{ kind: 'leader', ownerType: 'warband', ownerId: 'w1', token: '/w-lead' }
		];
		expect(resolveTokens(withLeaders, { id: 'w1', faction: 'iron-sultanate', displayModel: 'portrait' }).leaderToken).toBe('/w-lead');
		expect(resolveTokens(withLeaders, { id: 'w2', faction: 'iron-sultanate', displayModel: 'portrait' }).leaderToken).toBe('/f-lead');
		expect(resolveTokens(withLeaders, { id: 'w3', faction: 'black-grail', displayModel: 'model' }).leaderToken).toBeNull();
	});

	it('maps factions to the default outpost sheet, unknown ones to neutral', () => {
		expect(outpostFrame('new-antioch')).toBe('outposts_00');
		expect(outpostFrame('seven-headed-serpent')).toBe('outposts_05');
		expect(outpostFrame('house-faction')).toBe('outposts_06');
	});

	it('recognises binary and ASCII STL', () => {
		const bin = new Uint8Array(84 + 2 * 50);
		new DataView(bin.buffer).setUint32(80, 2, true);
		expect(looksLikeStl(bin)).toBe(true);
		expect(looksLikeStl(bin.subarray(0, 120))).toBe(false);
		const ascii = new TextEncoder().encode('solid box\n facet normal 0 0 1\n outer loop\n');
		expect(looksLikeStl(ascii)).toBe(true);
		expect(looksLikeStl(new TextEncoder().encode('<html>'))).toBe(false);
	});
});
