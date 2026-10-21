import { existsSync, globSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import ts from 'typescript';
import type { Config } from './config.ts';

/** What the code says, independent of the model. Every path is relative to the project root, with forward slashes. */
export interface Facts {
	modules: { path: string; imports: string[]; env: string[] }[];
	/** `docs` holds the doc comment of each handler: keyed by method (`GET`) or form action (`action:default`). */
	routes: { route: string; dir: string; files: string[]; methods: string[]; actions: string[]; docs: Record<string, Doc> }[];
	/** `schema` is set for tables declared with `pgSchema('x').table(…)`. */
	tables: { name: string; file: string; schema?: string }[];
	services: { name: string; file: string }[];
	volumes: { name: string; file: string }[];
}

/** A handler's doc comment: a summary line, then `Who:`, `In:`, `Out:`, `Errors:` lines. */
export interface Doc {
	summary: string;
	who?: string;
	in?: string;
	out?: string;
	errors?: string;
}

const TAGS: Record<string, keyof Doc> = { who: 'who', in: 'in', out: 'out', errors: 'errors' };

/** The text inside `/** … *\/` as a Doc; untagged lines continue the summary, or the tag before them. */
export function parseDoc(body: string): Doc {
	const doc: Doc = { summary: '' };
	let at: keyof Doc = 'summary';
	for (const raw of body.split('\n')) {
		const line = raw.replace(/^\s*\*?\s?/, '').trim();
		if (!line) continue;
		const tag = /^(who|in|out|errors):\s*(.*)$/i.exec(line);
		if (tag) at = TAGS[tag[1].toLowerCase()];
		const text = tag ? tag[2] : line;
		doc[at] = doc[at] ? `${doc[at]} ${text}` : text;
	}
	return doc;
}

/** An optional doc comment (group 1) directly above what follows it in a regex; ACTION_DOC ends its own line. */
const COMMENT = String.raw`\/\*\*((?:(?!\*\/)[\s\S])*)\*\/`;
const DOC = String.raw`(?:${COMMENT}\s*)?`;
const ACTION_DOC = String.raw`(?:${COMMENT}[ \t]*\n)?`;

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

/** `globs` may hold `!pattern` entries: files they match (tests, test helpers) are left out of the import graph. */
export function extractModules(root: string, globs: string[], alias: Record<string, string> = {}): Facts['modules'] {
	const exclude = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
	const include = globs.filter((g) => !g.startsWith('!'));
	const files = [...new Set(include.flatMap((g) => globSync(g, { cwd: root, exclude })))].map((f) => f.split('\\').join('/')).sort();
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
			const docs: Record<string, Doc> = {};
			for (const f of files) {
				const src = read(root, f);
				if (/\/\+server\.[jt]s$/.test(f))
					for (const m of src.matchAll(new RegExp(DOC + String.raw`export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b`, 'g'))) {
						methods.add(m[2]);
						if (m[1] !== undefined) docs[m[2]] = parseDoc(m[1]);
					}
				const at = src.indexOf('export const actions');
				if (/\/\+page\.server\.[jt]s$/.test(f) && at >= 0) {
					const end = src.slice(at).search(/\n\}/); // the closing brace in column 0: `};` or `} satisfies Actions;`
					const block = end >= 0 ? src.slice(at, at + end + 1) : src.slice(at);
					// The comment sits on its own lines above the tab-indented key: `\t/** … *\/\n\tname: …`.
					for (const m of block.matchAll(new RegExp(ACTION_DOC + String.raw`^\t(\w+)\s*:`, 'gm'))) {
						actions.add(m[2]);
						if (m[1] !== undefined) docs[`action:${m[2]}`] = parseDoc(m[1]);
					}
				}
			}
			out.push({ route: routeOf(posix.relative(routesDir, dir)), dir, files, methods: [...methods].sort(), actions: [...actions].sort(), docs });
		}
		for (const e of entries) if (e.isDirectory()) walk(posix.join(dir, e.name));
	};
	walk(routesDir);
	return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

export function extractTables(root: string, file: string): Facts['tables'] {
	const src = read(root, file);
	const tables: Facts['tables'] = [...src.matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map((m) => ({ name: m[1], file }));
	// `const auth = pgSchema('auth')` then `auth.table('users', …)`
	for (const [, id, schema] of src.matchAll(/\b([A-Za-z_$][\w$]*)\s*=\s*pgSchema\(\s*['"]([^'"]+)['"]/g))
		for (const m of src.matchAll(new RegExp(String.raw`(?<![\w$.])${id.replace(/\$/g, '\\$')}\.table\(\s*['"]([^'"]+)['"]`, 'g')))
			tables.push({ name: m[1], file, schema });
	return tables;
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
