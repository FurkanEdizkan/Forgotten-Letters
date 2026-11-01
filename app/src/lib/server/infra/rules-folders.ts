/**
 * Reads the rules folders under RULES_DIR: one sub-folder per version, its `*.json` files and `pages/*.json`, as
 * parsed JSON keyed by path, plus a checksum of the bytes so the Owner can tell two loads apart. Only I/O and JSON
 * syntax here; the format is checked by `lib/rules/check.ts`. A missing RULES_DIR is no folders, not an error.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Problem } from '#lib/rules/check';

export interface RulesFolder {
	folder: string;
	files: Record<string, unknown>;
	checksum: string;
	/** Files that could not be read or are not JSON. */
	problems: Problem[];
}

async function jsonFiles(dir: string, prefix = ''): Promise<string[]> {
	const out: string[] = [];
	for (const d of await readdir(dir, { withFileTypes: true })) {
		if (d.isFile() && d.name.endsWith('.json')) out.push(prefix + d.name);
		else if (d.isDirectory() && !prefix && d.name === 'pages')
			out.push(...(await jsonFiles(join(dir, d.name), 'pages/')));
	}
	return out.sort();
}

/** Every version folder under `root`; folders starting with `.` or `_` (the generator's sources) are not versions. */
export async function readRulesFolders(root: string): Promise<RulesFolder[]> {
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw e;
	}
	const out: RulesFolder[] = [];
	for (const d of entries.filter((d) => d.isDirectory() && !/^[._]/.test(d.name))) {
		const dir = join(root, d.name);
		const hash = createHash('sha256');
		const files: Record<string, unknown> = {};
		const problems: Problem[] = [];
		for (const file of await jsonFiles(dir)) {
			const bytes = await readFile(join(dir, file));
			hash.update(file).update('\0').update(bytes).update('\0');
			try {
				files[file] = JSON.parse(bytes.toString('utf8'));
			} catch (e) {
				problems.push({ file, message: `Not valid JSON: ${(e as Error).message}` });
			}
		}
		out.push({ folder: d.name, files, checksum: hash.digest('hex'), problems });
	}
	return out.sort((a, b) => a.folder.localeCompare(b.folder));
}
