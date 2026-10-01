import { existsSync, globSync } from 'node:fs';
import { join } from 'node:path';
import type { Facts } from './extract.ts';
import { ownerOf, within, type El, type Model } from './model.ts';

export interface Issue {
	kind: 'unowned-file' | 'missing-code' | 'unmodelled-import' | 'unmodelled-table' | 'unmodelled-service';
	message: string;
	/** What to do about it, in the model. */
	todo: string;
}

const ancestors = (id: string) => id.split('.').map((_, i, a) => a.slice(0, i + 1).join('.'));

/** A relationship from `a` (or anything it sits in, or holds) to `b` (likewise), in either generated or curated form. */
function related(model: Model, a: string, b: string) {
	const up = (x: string) => new Set(ancestors(x));
	const as = up(a), bs = up(b);
	return model.relationships.some((r) => (as.has(r.source) || within(r.source, a)) && (bs.has(r.target) || within(r.target, b)));
}

/** Where the code and the model disagree. Generated elements count as model (run `atlas update` to refresh them). */
export function check(root: string, facts: Facts, model: Model): Issue[] {
	const issues: Issue[] = [];
	const curated = model.elements.filter((e) => !e.generated);
	const owner = (p: string) => ownerOf(p, model.elements);

	const files = [...facts.modules.map((m) => m.path), ...facts.routes.flatMap((r) => r.files)];
	for (const path of [...new Set(files)].sort())
		if (!ownerOf(path, curated))
			issues.push({ kind: 'unowned-file', message: `${path} belongs to no element`, todo: `Add \`${path}\` to an element's \`code\` (or describe it as a new element).` });

	for (const el of curated)
		for (const p of el.code)
			if (/[*?{[]/.test(p) ? globSync(p, { cwd: root }).length === 0 : !existsSync(join(root, p)))
				issues.push({ kind: 'missing-code', message: `${el.id}: \`${p}\` matches no file`, todo: `Fix or remove \`${p}\` in ${el.id} (moved, renamed or deleted?).` });

	// Imports between curated elements need a relationship; imports from generated route elements are generated.
	const pairs = new Map<string, { a: El; b: El; example: string }>();
	const routeFiles = new Set(facts.routes.flatMap((r) => r.files));
	for (const m of facts.modules) {
		if (routeFiles.has(m.path)) continue; // `atlas update` writes these as generated relationships
		const a = owner(m.path);
		if (!a || a.generated) continue;
		for (const target of m.imports) {
			const b = ownerOf(target, curated);
			if (!b || within(a.id, b.id) || within(b.id, a.id) || related(model, a.id, b.id)) continue;
			const key = `${a.id} -> ${b.id}`;
			if (!pairs.has(key)) pairs.set(key, { a, b, example: `${m.path} imports ${target}` });
		}
	}
	for (const [key, { example }] of pairs)
		issues.push({ kind: 'unmodelled-import', message: `${key} has no relationship (${example})`, todo: `Add \`${key} '…what for…'\` to the model.` });

	const grouped = new Set(curated.flatMap((e) => e.tables));
	for (const t of facts.tables)
		if (!grouped.has(t.name)) issues.push({ kind: 'unmodelled-table', message: `table ${t.name} is in no group`, todo: `Add '${t.name}' to a table group's \`tables\` metadata.` });

	const named = new Set(curated.flatMap((e) => e.services));
	for (const s of [...facts.services, ...facts.volumes])
		if (!named.has(s.name)) issues.push({ kind: 'unmodelled-service', message: `${s.file}: ${s.name} is in no element`, todo: `Name '${s.name}' in an element's \`services\` metadata (or describe it as a new element).` });

	return issues;
}
