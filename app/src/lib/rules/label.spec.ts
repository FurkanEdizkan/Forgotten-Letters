/** Rules labels, with invented sets. */
import { describe, expect, it } from 'vitest';
import { rulesLabel, type SetHead } from './label';

const sets = new Map<string, SetHead>(
	[
		{ id: 'core-1.0.1', name: 'Trench Crusade', version: '1.0.1', preview: false },
		{ id: 'core-1.0.2', name: 'Trench Crusade', version: '1.0.2', preview: false },
		{ id: 'carcass-front-1.0', name: 'Carcass Front', version: '1.0', preview: false },
		{ id: 'tc-preview', name: 'Preview', version: '2026-11-03', preview: true },
		{ id: 'hb:01a2', name: 'Marsh Rules', version: '3', preview: false }
	].map((s) => [s.id, s])
);

describe('rulesLabel', () => {
	it('is the core version, then the chosen expansions in brackets', () => {
		expect(rulesLabel(sets, 'core-1.0.1')).toEqual({ text: '1.0.1', preview: false });
		expect(rulesLabel(sets, 'core-1.0.2', ['carcass-front-1.0']).text).toBe(
			'1.0.2 (Carcass Front)'
		);
		expect(rulesLabel(sets, 'core-1.0.2', ['carcass-front-1.0', 'hb:01a2']).text).toBe(
			'1.0.2 (Carcass Front, Marsh Rules)'
		);
	});
	it('says when a chosen set is a preview', () => {
		expect(rulesLabel(sets, 'core-1.0.2', ['tc-preview'])).toEqual({
			text: '1.0.2 (Preview)',
			preview: true
		});
	});
	it('shows the ids of sets that are not loaded', () => {
		expect(rulesLabel(sets, 'core-9', ['gone-1'])).toEqual({
			text: 'core-9 (gone-1)',
			preview: false
		});
	});
});
