import { describe, expect, it } from 'vitest';
import { blocks, segments } from './rules-text';

describe('rules text', () => {
	it('reads headings, tables, bullets and paragraphs', () => {
		const b = blocks('Intro text.\n\n### Forces\n\n| 1 | Empty\n\n| 2 | Two markers\n\n* Move: go.');
		expect(b.map((x) => x.kind)).toEqual(['para', 'heading', 'table', 'bullet']);
		expect(b[2]).toEqual({ kind: 'table', rows: [['1', 'Empty'], ['2', 'Two markers']] });
	});
	it('links glossary keywords, longest first', () => {
		const g = { 'IGNORE COVER': 'cover rule', FEAR: 'fear rule' };
		const s = segments('Has IGNORE COVER and FEAR but not LOUD.', g);
		expect(s.filter((x) => x.keyword).map((x) => x.keyword)).toEqual(['IGNORE COVER', 'FEAR']);
		expect(s.map((x) => x.text).join('')).toBe('Has IGNORE COVER and FEAR but not LOUD.');
	});
});
