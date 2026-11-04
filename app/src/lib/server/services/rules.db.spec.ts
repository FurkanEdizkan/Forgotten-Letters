import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ctx, person, sql, useTestDatabase } from '../testing/db';
import { RULES_FIXTURE } from '../testing/rules';
import * as rules from './rules';
import { resolveFaction } from '#lib/warbands';

// Read once with the rest of the settings, so it is set before the database helpers read them.
process.env.RULES_DIR = RULES_FIXTURE;
useTestDatabase();

/** A rules root holding the given folders ({ folder: { file: json } }). */
function rootWith(folders: Record<string, Record<string, unknown>>) {
	const root = mkdtempSync(join(tmpdir(), 'fl-rules-'));
	for (const [folder, files] of Object.entries(folders))
		for (const [file, value] of Object.entries(files)) {
			mkdirSync(join(root, folder, file, '..'), { recursive: true });
			writeFileSync(
				join(root, folder, file),
				typeof value === 'string' ? value : JSON.stringify(value)
			);
		}
	return root;
}

const reader = async () => (await person('user')).ctx();

describe('loading the rules folders', () => {
	it('loads good folders, keeps a broken one out with its report, and counts elements', async () => {
		const sets = await rules.loadAll(null, RULES_FIXTURE);
		expect(sets.map((s) => [s.id, s.ok])).toEqual([
			['broken-0.1', false],
			['core-1.0.1', true],
			['core-1.0.2', true],
			['mire-front-1.0', true],
			['mire-preview-1.0', true]
		]);
		const broken = sets[0]!;
		expect(broken).toMatchObject({ name: 'Broken Rules', kind: 'core', counts: {} });
		expect(broken.problems).toEqual([
			{
				file: 'items.json',
				id: 'item:rusty-blade',
				message: expect.stringContaining('kw:nowhere does not resolve')
			}
		]);
		expect(sets[2]!.counts).toMatchObject({
			item: 7,
			kw: 6,
			faction: 2,
			unit: 4,
			skill: 1,
			page: 6
		});
		expect(sets[3]).toMatchObject({
			kind: 'expansion',
			base: 'core-1.0.2',
			counts: { item: 1, line: 1, page: 1 }
		});
		expect(sets[2]!.checksum).toMatch(/^[0-9a-f]{64}$/);
	});
	it('replaces the cache on every load; a missing folder means no sets', async () => {
		await rules.loadAll(null, RULES_FIXTURE);
		await rules.loadAll(null, RULES_FIXTURE);
		const [n] = await sql()`select count(*)::int as n from rules.sets`;
		expect(n!.n).toBe(5);
		expect(await rules.loadAll(null, join(tmpdir(), 'fl-no-such-rules'))).toEqual([]);
	});
	it('fails an expansion whose base failed or is missing, a folder named unlike its manifest, and bad JSON', async () => {
		const m = (id: string, base?: string) => ({
			id,
			name: id,
			kind: base ? 'expansion' : 'core',
			version: '1',
			...(base ? { base } : {})
		});
		const root = rootWith({
			'stone-1': { 'manifest.json': m('stone-1'), 'items.json': '[{' },
			'moss-1': { 'manifest.json': m('moss-1', 'stone-1') },
			'lichen-1': { 'manifest.json': m('lichen-1', 'nowhere-1') },
			'fern-1': { 'manifest.json': m('fern-2') }
		});
		const sets = Object.fromEntries((await rules.loadAll(null, root)).map((s) => [s.id, s]));
		expect(sets['stone-1']!.problems[0]).toMatchObject({
			file: 'items.json',
			message: expect.stringContaining('Not valid JSON')
		});
		expect(sets['moss-1']!.problems[0]!.message).toContain('stone-1 did not load');
		expect(sets['lichen-1']!.problems[0]!.message).toContain(
			'nowhere-1 is not in the rules folder'
		);
		expect(sets['fern-1']!.problems[0]!.message).toContain('differs from the folder name');
		expect(Object.values(sets).every((s) => !s.ok)).toBe(true);
	});
	it('reloads for an Owner (audited) and refuses anyone else', async () => {
		const owner = await person('owner');
		const admin = await person('admin');
		expect((await rules.reload(owner.ctx())).map((s) => s.id)).toHaveLength(5);
		const [row] =
			await sql()`select action, actor_id from auth.audit_log where action = 'rules.reloaded'`;
		expect(row).toEqual({ action: 'rules.reloaded', actor_id: owner.row.id });
		await expect(rules.reload(admin.ctx())).rejects.toMatchObject({ code: 'forbidden' });
		await expect(rules.reload(ctx())).rejects.toMatchObject({ code: 'unauthenticated' });
	});
});

describe('reading a set', () => {
	beforeAll(async () => {
		await rules.loadAll(null, RULES_FIXTURE);
	});
	it('opens on the newest core version', async () => {
		expect(await rules.defaultSet(await reader())).toBe('core-1.0.2');
	});
	it('searches by name, over an expansion and its base, and by type', async () => {
		const c = await reader();
		const found = await rules.search(c, 'mire-front-1.0', { q: 'BOOTS', limit: 50 });
		expect(found.map((f) => [f.id, f.setId])).toEqual([
			['item:mire-boots', 'mire-front-1.0'],
			['line:lantern-guild/mire-boots', 'mire-front-1.0']
		]);
		const rifle = await rules.search(c, 'mire-front-1.0', { q: 'rifle', type: 'item', limit: 50 });
		expect(rifle).toEqual([
			{ id: 'item:hook-rifle', type: 'item', name: 'Hook Rifle', setId: 'core-1.0.2' }
		]);
		expect(await rules.search(c, 'core-1.0.2', { q: '100%_', limit: 50 })).toEqual([]);
		expect((await rules.search(c, 'core-1.0.2', { limit: 3 })).length).toBe(3);
	});
	it('refuses a set that is not loaded, and anyone signed out', async () => {
		const c = await reader();
		await expect(rules.search(c, 'broken-0.1', { limit: 5 })).rejects.toMatchObject({
			code: 'not_found'
		});
		await expect(rules.search(c, 'core-9', { limit: 5 })).rejects.toMatchObject({
			code: 'not_found'
		});
		await expect(rules.search(ctx(), 'core-1.0.2', { limit: 5 })).rejects.toMatchObject({
			code: 'unauthenticated'
		});
	});
	it('gives an element with its links in and out and its neighbourhood', async () => {
		const n = await rules.node(await reader(), 'core-1.0.2', 'unit:lantern-guild/warden');
		expect(n.node).toMatchObject({
			name: 'Warden',
			type: 'unit',
			setId: 'core-1.0.2',
			data: { cost: 60 }
		});
		const links = (l: { kind: string; id: string }[]) => l.map((x) => `${x.kind} ${x.id}`);
		expect(links(n.out)).toEqual(
			expect.arrayContaining([
				'belongs_to faction:lantern-guild',
				'fixed_kit item:lantern',
				'has_keyword kw:stalwart',
				'has_upgrade upgrade:lantern-guild/veteran'
			])
		);
		expect(links(n.in)).toEqual(
			expect.arrayContaining([
				'restricts line:lantern-guild/pavise',
				'mentions faction:lantern-guild'
			])
		);
		const depth = Object.fromEntries(n.graph.nodes.map((x) => [x.id, x.depth]));
		expect(depth['unit:lantern-guild/warden']).toBe(0);
		expect(depth['item:lantern']).toBe(1);
		expect(depth['kw:steady']).toBe(2);
		expect(n.graph.links).toContainEqual({
			from: 'item:lantern',
			to: 'kw:steady',
			kind: 'has_keyword'
		});
		const near = await rules.node(await reader(), 'core-1.0.2', 'unit:lantern-guild/warden', 1);
		expect(near.graph.nodes.every((x) => x.depth <= 1)).toBe(true);
		await expect(rules.node(await reader(), 'core-1.0.2', 'item:none')).rejects.toMatchObject({
			code: 'not_found'
		});
	});
	it('caps the neighbourhood', async () => {
		const n = await rules.node(await reader(), 'core-1.0.2', 'faction:lantern-guild');
		expect(n.graph.nodes.length).toBeLessThanOrEqual(rules.GRAPH_CAP);
	});
	it('gives the index of names, keywords and pages, and merged elements', async () => {
		const c = await reader();
		const ix = await rules.index(c, 'mire-front-1.0');
		expect(ix.chain).toEqual(['core-1.0.2', 'mire-front-1.0']);
		expect(ix.names['item:mire-boots']).toEqual({ name: 'Mire Boots', type: 'item' });
		expect(ix.keywords['kw:steady']!.text).toContain('steady model');
		expect(ix.pages.filter((p) => p.section === 'campaigns').map((p) => p.id)).toEqual([
			'page:campaigns/upkeep',
			'page:mire/campaign'
		]);
		const items = await rules.elements(c, 'mire-front-1.0', ['item']);
		expect(items.map((i) => i.id).sort()).toContain('item:mire-boots');
		expect(items).toHaveLength(8);
	});
	it('shows what changed between two versions', async () => {
		const d = await rules.diff(await reader(), 'core-1.0.1', 'core-1.0.2');
		expect(d.added.map((a) => a.id)).toEqual(['item:pike', 'line:lantern-guild/pike']);
		expect(d.removed.map((a) => a.id)).toEqual(['item:bell', 'line:lantern-guild/bell']);
		expect(d.changed.find((c) => c.id === 'item:hook-rifle')!.fields).toEqual([
			{ path: 'range', from: '18"', to: '24"' }
		]);
	});
});

describe('a set for the warband engine', () => {
	it('rebuilds a core version with an expansion as a based chain the engine resolves', async () => {
		await rules.loadAll(null, RULES_FIXTURE);
		const set = await rules.rulesSetOf('core-1.0.2', ['mire-front-1.0']);
		expect(set.manifest.id).toBe('mire-front-1.0');
		expect(set.base?.manifest).toMatchObject({ id: 'core-1.0.2', kind: 'core' });
		expect(set.armouryLines.map((l) => l.id)).toEqual(['line:lantern-guild/mire-boots']);
		const f = resolveFaction(set, 'faction:lantern-guild');
		expect(f.lines.map((l) => l.id)).toContain('line:lantern-guild/mire-boots');
		expect(f.lines.map((l) => l.id)).toContain('line:lantern-guild/hook-rifle');
		expect(f.patrons.map((p) => p.skills.map((s) => s.id))).toEqual([['skill:the-keeper/vigil']]);
		// Cached until the next load.
		expect(await rules.rulesSetOf('core-1.0.2', ['mire-front-1.0'])).toBe(set);
		await rules.loadAll(null, RULES_FIXTURE);
		expect(await rules.rulesSetOf('core-1.0.2', ['mire-front-1.0'])).not.toBe(set);
	});
	it('refuses a version that is not loaded, or an expansion as the core', async () => {
		await rules.loadAll(null, RULES_FIXTURE);
		await expect(rules.rulesSetOf('core-9.9')).rejects.toMatchObject({ code: 'not_found' });
		await expect(rules.rulesSetOf('broken-0.1')).rejects.toMatchObject({ code: 'not_found' });
		await expect(rules.rulesSetOf('mire-front-1.0')).rejects.toMatchObject({ code: 'invalid' });
		await expect(rules.rulesSetOf('core-1.0.2', ['nowhere-1.0'])).rejects.toMatchObject({
			code: 'not_found'
		});
	});
});
