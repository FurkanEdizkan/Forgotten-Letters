import { describe, expect, it } from 'vitest';
import { checkSet, readSet } from './check';

const manifest = { id: 'moss-1.0', name: 'Moss', kind: 'core', version: '1.0' };
const kw = { id: 'kw:soft', name: 'Soft', kind: 'tag', text: '' };
const item = (over: object = {}) => ({
	id: 'item:moss-club',
	name: 'Moss Club',
	category: 'melee',
	type: '1-Handed',
	keywords: [{ kw: 'kw:soft' }],
	...over
});

describe('readSet', () => {
	it('parses a folder; missing files are empty and pages may be one page or a list', () => {
		const r = readSet({
			'manifest.json': manifest,
			'keywords.json': [kw],
			'pages/one.json': { id: 'page:one', section: 'core-rules', title: 'One', order: 1, body: '' },
			'pages/more.json': [{ id: 'page:two', section: 'errata', title: 'Two', order: 2, body: '' }]
		});
		expect(r.problems).toEqual([]);
		expect(r.set!.items).toEqual([]);
		expect(r.set!.pages.map((p) => p.id)).toEqual(['page:one', 'page:two']);
		expect(r.fileOf.get('page:two')).toBe('pages/more.json');
	});
	it('names the file and element of a schema error, and refuses unknown files', () => {
		const r = readSet({
			'manifest.json': manifest,
			'items.json': [item({ colour: 'green' })],
			'notes.json': {}
		});
		expect(r.set).toBeNull();
		expect(r.problems).toEqual([
			expect.objectContaining({ file: 'items.json', id: 'item:moss-club' }),
			expect.objectContaining({
				file: 'notes.json',
				message: expect.stringContaining('Unknown file')
			})
		]);
	});
	it('needs a manifest', () => {
		expect(readSet({}).problems[0]).toMatchObject({ file: 'manifest.json' });
	});
});

describe('checkSet', () => {
	const check = (files: Record<string, unknown>, base = new Set<string>()) => {
		const r = readSet({ 'manifest.json': manifest, ...files });
		return checkSet(r.set!, r.fileOf, base);
	};
	it('passes a set whose ids all resolve, with its elements and edges', () => {
		const r = check({ 'keywords.json': [kw], 'items.json': [item()] });
		expect(r.problems).toEqual([]);
		expect(r.checked!.elements.map((e) => e.id)).toEqual(['kw:soft', 'item:moss-club']);
		expect(r.checked!.edges).toEqual([
			{ from: 'item:moss-club', to: 'kw:soft', kind: 'has_keyword' }
		]);
	});
	it('reports an id that does not resolve, with file and element', () => {
		const r = check({ 'items.json': [item()] });
		expect(r.checked).toBeNull();
		expect(r.problems).toEqual([
			{
				file: 'items.json',
				id: 'item:moss-club',
				message: expect.stringContaining('kw:soft does not resolve')
			}
		]);
	});
	it('lets lines belong to the Mercenaries pool, which is not an element', () => {
		const line = {
			id: 'line:mercenaries:moss-club',
			owner: 'faction:mercenaries',
			item: 'item:moss-club',
			cost: 3,
			currency: 'ducats'
		};
		const r = check({
			'keywords.json': [kw],
			'items.json': [item()],
			'armoury-lines.json': [line]
		});
		expect(r.problems).toEqual([]);
	});
	it('resolves against the base chain, and inside text links', () => {
		expect(check({ 'items.json': [item()] }, new Set(['kw:soft'])).problems).toEqual([]);
		const r = check({ 'keywords.json': [{ ...kw, text: 'Unlike [[kw:hard]].' }] });
		expect(r.problems[0]).toMatchObject({ file: 'keywords.json', id: 'kw:soft' });
	});
	it('reports an id used twice', () => {
		const r = check({ 'keywords.json': [kw, kw] });
		expect(r.problems[0]!.message).toContain('used twice');
	});
	it('checks the ids in legal lists', () => {
		const r = check({
			'legal-lists.json': [{ target: 'faction:none', name: 'Empty list', legal: true, models: [] }]
		});
		expect(r.problems).toEqual([
			{ file: 'legal-lists.json', message: 'Empty list: faction:none does not resolve.' }
		]);
	});
});
