import { describe, expect, it } from 'vitest';
import { blocks, elementHref, inline, linksIn } from './text';

describe('rules text links', () => {
	it('finds [[id]] and [[id|label]] links in order', () => {
		expect(
			linksIn('Use [[kw:steady]] or [[item:hook-rifle|the rifle]], then [[kw:steady]].')
		).toEqual(['kw:steady', 'item:hook-rifle', 'kw:steady']);
		expect(linksIn('No links [here] or [[ ]]')).toEqual([]);
	});
	it('splits a line into text and links', () => {
		expect(inline('See [[kw:steady]] and [[item:x|the X]].')).toEqual([
			{ t: 'text', text: 'See ' },
			{ t: 'link', id: 'kw:steady', label: null },
			{ t: 'text', text: ' and ' },
			{ t: 'link', id: 'item:x', label: 'the X' },
			{ t: 'text', text: '.' }
		]);
		expect(inline('')).toEqual([]);
	});
	it('reads headings, paragraphs and lists', () => {
		const out = blocks(
			'## Moving\nA model moves.\nIt stops.\n\n- Walk\n- [[kw:dash]]\nAfter the list.'
		);
		expect(out).toEqual([
			{ t: 'h', text: [{ t: 'text', text: 'Moving' }] },
			{ t: 'p', text: [{ t: 'text', text: 'A model moves. It stops.' }] },
			{
				t: 'ul',
				items: [[{ t: 'text', text: 'Walk' }], [{ t: 'link', id: 'kw:dash', label: null }]]
			},
			{ t: 'p', text: [{ t: 'text', text: 'After the list.' }] }
		]);
		expect(blocks('<b>raw</b>')).toEqual([{ t: 'p', text: [{ t: 'text', text: '<b>raw</b>' }] }]);
	});
	it('reads "* " bullets as list items too (faction and variant rules use them)', () => {
		expect(blocks('* Far: one rule.\n* Near: another.')).toEqual([
			{
				t: 'ul',
				items: [[{ t: 'text', text: 'Far: one rule.' }], [{ t: 'text', text: 'Near: another.' }]]
			}
		]);
	});
	it('builds element links with path segments kept and # encoded', () => {
		expect(elementHref('core-1.0.2', 'unit:guild/warden')).toBe(
			'/rules/core-1.0.2/e/unit%3Aguild/warden'
		);
		expect(elementHref('core-1.0.2', 'table:wounds#7')).toBe(
			'/rules/core-1.0.2/e/table%3Awounds%237'
		);
	});
});
