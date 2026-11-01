import { describe, expect, it } from 'vitest';
import { diff } from './diff';
import type { Element } from './elements';

const item = (id: string, name: string, data: object): Element => ({
	id,
	type: 'item',
	name,
	data: { id, name, ...data }
});

describe('diff', () => {
	it('lists added, removed and changed elements with field changes', () => {
		const from = [
			item('item:rod', 'Rod', { range: '18"', keywords: [{ kw: 'kw:far', value: 2 }] }),
			item('item:bell', 'Bell', {}),
			item('item:same', 'Same', { range: '1"' })
		];
		const to = [
			item('item:rod', 'Rod', {
				range: '24"',
				keywords: [{ kw: 'kw:far', value: 3 }],
				text: 'New.'
			}),
			item('item:pike', 'Pike', {}),
			item('item:same', 'Same', { range: '1"' })
		];
		const d = diff(from, to);
		expect(d.added).toEqual([{ id: 'item:pike', type: 'item', name: 'Pike' }]);
		expect(d.removed).toEqual([{ id: 'item:bell', type: 'item', name: 'Bell' }]);
		expect(d.changed).toEqual([
			{
				id: 'item:rod',
				type: 'item',
				name: 'Rod',
				fields: [
					{ path: 'range', from: '18"', to: '24"' },
					{ path: 'keywords.0.value', from: 2, to: 3 },
					{ path: 'text', from: undefined, to: 'New.' }
				]
			}
		]);
	});
	it('is empty for the same set', () => {
		const s = [item('item:a', 'A', { range: '2"' })];
		expect(diff(s, s)).toEqual({ added: [], removed: [], changed: [] });
	});
});
