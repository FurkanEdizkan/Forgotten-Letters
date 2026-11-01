import { describe, expect, it } from 'vitest';
import { edgesOf, idsIn, isId, target } from './edges';
import { tiny } from './tiny.fixture';

const has = (
	edges: { from: string; to: string; kind: string }[],
	from: string,
	kind: string,
	to: string
) => edges.some((e) => e.from === from && e.kind === kind && e.to === to);

describe('ids', () => {
	it('tells ids from words and strips table rows', () => {
		expect(isId('unit:reeds/chief')).toBe(true);
		expect(isId('Goetic Power')).toBe(false);
		expect(isId('nope:x')).toBe(false);
		expect(target('table:mud#1')).toBe('table:mud');
		expect([...idsIn({ a: ['kw:x', 'plain'], 'item:y': { b: 'faction:z' } })].sort()).toEqual([
			'faction:z',
			'item:y',
			'kw:x'
		]);
	});
});

describe('edgesOf', () => {
	const edges = edgesOf(tiny());
	it.each([
		['unit:reeds/chief', 'belongs_to', 'faction:reeds'],
		['line:reeds/pole', 'belongs_to', 'faction:reeds'],
		['line:reeds/pole', 'may_take', 'item:pole'],
		['line:reeds/pole', 'restricts', 'unit:reeds/chief'],
		['unit:reeds/chief', 'fixed_kit', 'item:pole'],
		['unit:reeds/chief', 'may_take', 'item:sling'],
		['unit:reeds/chief', 'has_keyword', 'kw:calm'],
		['item:pole', 'has_keyword', 'kw:brave'],
		['unit:reeds/chief', 'has_upgrade', 'upgrade:reeds/scarred'],
		['unit:reeds/chief', 'counts_as', 'unit:reeds/poler'],
		['unit:reeds/chief', 'restricts', 'item:sling'],
		['unit:reeds/wader', 'replaces', 'unit:reeds/poler'],
		['variant:reeds/marsh', 'belongs_to', 'faction:reeds'],
		['variant:reeds/marsh', 'adds', 'unit:hired/blade'],
		['variant:reeds/marsh', 'excludes', 'item:sling'],
		['faction:reeds', 'hires', 'unit:hired/blade'],
		['faction:reeds', 'restricts', 'unit:reeds/chief'],
		['faction:reeds', 'mentions', 'unit:reeds/chief'],
		['patron:heron', 'serves', 'faction:reeds'],
		['skill:heron/still', 'belongs_to', 'patron:heron'],
		['upgrade:reeds/scarred', 'restricts', 'unit:reeds/chief'],
		['kw:brave', 'mentions', 'kw:calm'],
		['table:mud', 'belongs_to', 'faction:reeds'],
		['table:mud', 'mentions', 'item:sling'],
		['page:a', 'mentions', 'table:mud'],
		['page:a/b', 'belongs_to', 'page:a']
	])('%s %s %s', (from, kind, to) => {
		expect(has(edges, from, kind, to)).toBe(true);
	});
	it('reads a loadout choice slot as its items, never as a text link', () => {
		const set = tiny();
		set.units[0]!.kit.loadouts = [[['item:sling', 'item:pole']]];
		const e = edgesOf(set);
		expect(e.filter((x) => x.kind === 'mentions' && !isId(x.to))).toEqual([]);
		expect(has(e, set.units[0]!.id, 'may_take', 'item:pole')).toBe(true);
	});
	it('keeps each edge once', () => {
		const keys = edges.map((e) => `${e.from} ${e.kind} ${e.to}`);
		expect(new Set(keys).size).toBe(keys.length);
		// hiredBy and the faction's mercenaries name the same link.
		expect(keys.filter((k) => k === 'faction:reeds hires unit:hired/blade')).toHaveLength(1);
	});
});
