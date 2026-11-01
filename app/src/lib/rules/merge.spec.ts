import { describe, expect, it } from 'vitest';
import { mergeElements } from './elements';
import { merge } from './merge';
import { rulesSet } from './pack';

const set = (id: string, items: { id: string; name: string }[], base?: string) =>
	rulesSet.parse({
		manifest: {
			id,
			name: id,
			kind: base ? 'expansion' : 'core',
			version: '1',
			...(base ? { base } : {})
		},
		items: items.map((i) => ({ ...i, category: 'melee', type: '1-Handed', keywords: [] }))
	});

describe('merge', () => {
	it('keeps the base, replaces same ids and adds new ones; the manifest is the set’s', () => {
		const base = set('stone-1', [
			{ id: 'item:a', name: 'A' },
			{ id: 'item:b', name: 'B' }
		]);
		const exp = set(
			'moss-1',
			[
				{ id: 'item:b', name: 'B two' },
				{ id: 'item:c', name: 'C' }
			],
			'stone-1'
		);
		const out = merge(base, exp);
		expect(out.manifest.id).toBe('moss-1');
		expect(out.items.map((i) => `${i.id}=${i.name}`)).toEqual([
			'item:a=A',
			'item:b=B two',
			'item:c=C'
		]);
		expect(out.keywords).toEqual([]);
	});
	it('merges element lists over a chain, later winning', () => {
		const e = (id: string, name: string) => ({ id, type: 'item' as const, name, data: {} });
		expect(
			mergeElements([[e('item:a', 'A'), e('item:b', 'B')], [e('item:b', 'B2')]]).map((x) => x.name)
		).toEqual(['A', 'B2']);
	});
});
