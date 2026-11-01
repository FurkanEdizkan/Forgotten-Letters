import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRulesFolders } from './rules-folders';

describe('readRulesFolders', () => {
	it('reads version folders and skips the generator sources (_src) and hidden folders', async () => {
		const root = mkdtempSync(join(tmpdir(), 'fl-rules-'));
		for (const name of ['moss-1.0', '_src', '.cache']) {
			mkdirSync(join(root, name));
			writeFileSync(join(root, name, 'manifest.json'), JSON.stringify({ id: name }));
		}
		expect((await readRulesFolders(root)).map((f) => f.folder)).toEqual(['moss-1.0']);
	});
	it('reads nothing when the folder is missing', async () => {
		expect(await readRulesFolders(join(tmpdir(), 'fl-no-such-rules-folder'))).toEqual([]);
	});
});
