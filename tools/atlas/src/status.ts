import { execFileSync } from 'node:child_process';
import { ownerOf, within, type Model } from './model.ts';

const git = (root: string, ...args: string[]) => {
	try {
		// trimEnd only: `git status --porcelain` lines start with a space (" M path").
		return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trimEnd();
	} catch {
		return '';
	}
};

/** Files this branch changed against `base` (committed, staged, unstaged and untracked). On `base` itself: uncommitted only. */
export function changedFiles(root: string, base: string): { branch: string; files: string[] } {
	const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
	const committed = branch && branch !== base && git(root, 'rev-parse', '--verify', '--quiet', base) ? git(root, 'diff', '--name-only', `${base}...HEAD`) : '';
	const working = git(root, 'status', '--porcelain', '--untracked-files=all')
		.split('\n')
		.filter(Boolean)
		.map((l) => l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
	return { branch, files: [...new Set([...committed.split('\n').filter(Boolean), ...working])].sort() };
}

export interface Behind {
	/** Curated elements whose code changed while no curated .c4 file did. */
	elements: { id: string; title: string; files: string[] }[];
	/** Changed code that no element owns yet. */
	unowned: string[];
	/** Feature views that walk through those elements: worth a look. */
	features: string[];
}

/**
 * Is the architecture behind the code on this branch? `codeFiles` are the files the extractors read; `modelDir` is
 * the model folder relative to the root. Generated .c4 and the .atlas cache don't count as a model update.
 */
export function behind(changed: string[], codeFiles: Set<string>, modelDir: string, model: Model): Behind | null {
	const curated = model.elements.filter((e) => !e.generated);
	const modelTouched = changed.some((f) => f.startsWith(modelDir + '/') && f.endsWith('.c4') && !f.startsWith(`${modelDir}/generated/`));
	const code = changed.filter((f) => codeFiles.has(f) || ownerOf(f, curated));
	if (!code.length || modelTouched) return null;
	const byEl = new Map<string, { id: string; title: string; files: string[] }>();
	const unowned: string[] = [];
	for (const f of code) {
		const el = ownerOf(f, curated);
		if (!el) unowned.push(f);
		else (byEl.get(el.id) ?? byEl.set(el.id, { id: el.id, title: el.title, files: [] }).get(el.id)!).files.push(f);
	}
	const ids = [...byEl.keys()];
	const features = model.views
		.filter((v) => v.dynamic && v.steps.some((s) => ids.some((id) => [s.from, s.to].some((x) => within(x, id) || within(id, x)))))
		.map((v) => v.id);
	return { elements: [...byEl.values()], unowned, features };
}
