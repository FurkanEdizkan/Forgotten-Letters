import { existsSync, globSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import ts from 'typescript';
import type { Config } from './config.ts';

/** What the code says, independent of the model. Every path is relative to the project root, with forward slashes. */
export interface Facts {
	modules: { path: string; imports: string[]; env: string[] }[];
	routes: { route: string; dir: string; files: string[]; methods: string[]; actions: string[] }[];
	tables: { name: string; file: string }[];
	services: { name: string; file: string }[];
	volumes: { name: string; file: string }[];
}

const rel = (root: string, abs: string) => relative(root, abs).split('\\').join('/');
const read = (root: string, p: string) => readFileSync(join(root, p), 'utf8');

/** Svelte keeps its code in <script> blocks; everything else is code already. */
const codeOf = (path: string, src: string) =>
	path.endsWith('.svelte') ? [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n') : src;

function resolveImport(root: string, from: string, spec: string, alias: Record<string, string>): string | null {
	let base: string | null = null;
	if (spec.startsWith('.')) base = resolve(root, dirname(from), spec);
	else
		for (const [a, target] of Object.entries(alias))
			if (spec === a || spec.startsWith(a + '/')) base = resolve(root, target + spec.slice(a.length));
	if (!base) return null; // a package, or a framework module ($app, $env)
	for (const c of [base, `${base}.ts`, `${base}.js`, `${base}.svelte`, join(base, 'index.ts'), join(base, 'index.js')])
		if (existsSync(c) && statSync(c).isFile()) return rel(root, c);
	return null;
}

export function extractModules(root: string, globs: string[], alias: Record<string, string> = {}): Facts['modules'] {
	const files = [...new Set(globs.flatMap((g) => globSync(g, { cwd: root })))].map((f) => f.split('\\').join('/')).sort();
	return files.map((path) => {
		const code = codeOf(path, read(root, path));
		const specs = ts.preProcessFile(code, true, true).importedFiles.map((f) => f.fileName);
		const imports = [...new Set(specs.map((s) => resolveImport(root, path, s, alias)).filter((p): p is string => !!p && p !== path))].sort();
		const env = [...new Set([...code.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]))].sort();
		return { path, imports, env };
	});
}

/** A SvelteKit route's URL: (group) folders drop out, [params] stay. */
export const routeOf = (dirFromRoutes: string) =>
	'/' + dirFromRoutes.split('/').filter((s) => s && !(s.startsWith('(') && s.endsWith(')'))).join('/');

export function extractRoutes(root: string, routesDir: string): Facts['routes'] {
	const out: Facts['routes'] = [];
	const walk = (dir: string) => {
		const entries = readdirSync(join(root, dir), { withFileTypes: true });
		const files = entries.filter((e) => e.isFile() && e.name.startsWith('+')).map((e) => posix.join(dir, e.name)).sort();
		if (files.length) {
			const methods = new Set<string>();
			const actions = new Set<string>();
			for (const f of files) {
				const src = read(root, f);
				if (/\/\+server\.[jt]s$/.test(f))
					for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) methods.add(m[1]);
				const at = src.indexOf('export const actions');
				if (/\/\+page\.server\.[jt]s$/.test(f) && at >= 0) {
					const block = src.slice(at, src.indexOf('\n};', at) + 1 || undefined);
					for (const m of block.matchAll(/^\t(\w+)\s*:/gm)) actions.add(m[1]);
				}
			}
			out.push({ route: routeOf(posix.relative(routesDir, dir)), dir, files, methods: [...methods].sort(), actions: [...actions].sort() });
		}
		for (const e of entries) if (e.isDirectory()) walk(posix.join(dir, e.name));
	};
	walk(routesDir);
	return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

export function extractTables(root: string, file: string): Facts['tables'] {
	return [...read(root, file).matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map((m) => ({ name: m[1], file }));
}

/** Top-level `services:` and `volumes:` keys of a compose file (two-space indented names). */
export function extractCompose(root: string, file: string): Pick<Facts, 'services' | 'volumes'> {
	const found = { services: [] as Facts['services'], volumes: [] as Facts['volumes'] };
	let section: keyof typeof found | null = null;
	for (const line of read(root, file).split('\n')) {
		const top = /^([a-z][\w-]*):/.exec(line);
		if (top) section = top[1] === 'services' || top[1] === 'volumes' ? top[1] : null;
		const key = /^ {2}([\w.-]+):/.exec(line);
		if (section && key) found[section].push({ name: key[1], file });
	}
	return found;
}

export function extract(root: string, config: Config): Facts {
	const x = config.extract;
	return {
		modules: x.imports ? extractModules(root, x.imports, x.alias) : [],
		routes: x.sveltekit ? extractRoutes(root, x.sveltekit) : [],
		tables: x.drizzle ? extractTables(root, x.drizzle) : [],
		...(x.compose ? extractCompose(root, x.compose) : { services: [], volumes: [] })
	};
}
