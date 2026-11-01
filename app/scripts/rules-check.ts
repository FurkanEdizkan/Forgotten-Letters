/**
 * Check a generated rules folder against the contract (src/lib/rules/pack.ts): every file parses, ids are unique,
 * and every referenced id resolves within the set or its base folder (expansions name their base in the manifest).
 * Prints counts per type and each problem with its file and id; exits 1 on any error.
 *
 *     node --experimental-strip-types scripts/rules-check.ts ../rules/core-1.0.2 [more folders]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { FILES, manifest, page, id as idSchema, typeOf } from '../src/lib/rules/pack.ts';

/** Owners the contract names without an element of their own (pack.ts, `unit.owner`). */
const RESERVED = new Set(['faction:mercenaries']);
const ID =
	/^(faction|variant|unit|item|line|kw|upgrade|patron|skill|table|scenario|page|loc):[a-z0-9][a-z0-9:/#._-]*$/;
const LINK = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

type El = Record<string, unknown>;
interface Loaded {
	dir: string;
	ids: Map<string, string>; // id → file
	rows: Set<string>; // table:x#roll
	els: { file: string; el: El }[];
	base?: Loaded;
	errors: string[];
}

const readJson = (path: string, errors: string[]): unknown => {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (e) {
		errors.push(`${basename(path)}: not JSON (${(e as Error).message})`);
		return undefined;
	}
};

function load(dir: string, seen = new Set<string>()): Loaded {
	const errors: string[] = [];
	const set: Loaded = { dir, ids: new Map(), rows: new Set(), els: [], errors };
	const m = readJson(join(dir, 'manifest.json'), errors);
	const man = manifest.safeParse(m);
	if (!man.success)
		errors.push(
			`manifest.json: ${man.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`
		);
	const parse = (
		file: string,
		schema: {
			safeParse: (v: unknown) => {
				success: boolean;
				error?: { issues: { path: PropertyKey[]; message: string }[] };
			};
		},
		data: unknown
	) => {
		const r = schema.safeParse(data);
		if (!r.success) {
			for (const i of r.error!.issues.slice(0, 50)) {
				const at =
					i.path.length && Array.isArray(data)
						? ((data[Number(i.path[0])] as El | undefined)?.id ?? `#${String(i.path[0])}`)
						: '';
				errors.push(`${file}: ${String(at)} ${i.path.slice(1).join('.')}: ${i.message}`);
			}
		}
		if (Array.isArray(data))
			for (const el of data) if (el && typeof el === 'object') set.els.push({ file, el: el as El });
	};
	for (const [file, schema] of Object.entries(FILES)) {
		const path = join(dir, file);
		if (existsSync(path)) parse(file, schema, readJson(path, errors));
	}
	const pdir = join(dir, 'pages');
	if (existsSync(pdir))
		for (const f of readdirSync(pdir)
			.filter((f) => f.endsWith('.json'))
			.sort()) {
			// A page file holds one page or a list of them, as the app's loader reads it.
			const data = readJson(join(pdir, f), errors);
			parse(`pages/${f}`, page.array(), Array.isArray(data) ? data : data == null ? data : [data]);
		}
	for (const { file, el } of set.els) {
		const own: string[] = typeof el.id === 'string' ? [el.id] : [];
		if (Array.isArray(el.skills))
			for (const s of el.skills as El[]) if (typeof s.id === 'string') own.push(s.id);
		for (const i of own) {
			if (set.ids.has(i)) errors.push(`${file}: ${i}: duplicate id (also in ${set.ids.get(i)})`);
			set.ids.set(i, file);
		}
		if (Array.isArray(el.rows))
			for (const r of el.rows as El[]) set.rows.add(`${String(el.id)}#${String(r.roll)}`);
	}
	if (man.success && man.data.base) {
		const bdir = join(dirname(dir), man.data.base);
		if (seen.has(bdir) || !existsSync(join(bdir, 'manifest.json')))
			errors.push(`manifest.json: base ${man.data.base} not found next to this folder`);
		else {
			set.base = load(bdir, new Set([...seen, dir]));
			for (const i of set.ids.keys())
				if (resolves(set.base, i))
					errors.push(`${set.ids.get(i)}: ${i}: also defined in the base ${man.data.base}`);
		}
	}
	return set;
}

function resolves(set: Loaded | undefined, ref: string): boolean {
	for (let s = set; s; s = s.base) {
		if (s.ids.has(ref) || s.rows.has(ref)) return true;
		const hash = ref.indexOf('#');
		if (hash > 0 && s.ids.has(ref.slice(0, hash)) && !ref.startsWith('table:')) return true;
	}
	return RESERVED.has(ref);
}

/** Every id-shaped string under an element, except its own ids, plus [[id]] links in text. */
function refs(v: unknown, out: string[], top = true): void {
	if (typeof v === 'string') {
		if (ID.test(v)) out.push(v);
		else for (const m of v.matchAll(LINK)) out.push(m[1].trim());
	} else if (Array.isArray(v)) for (const x of v) refs(x, out, false);
	else if (v && typeof v === 'object')
		for (const [k, x] of Object.entries(v)) {
			if (k === 'id' && (top || typeof x === 'string')) continue;
			if (k === 'items' && x && typeof x === 'object' && !Array.isArray(x)) {
				// kit.items is keyed by item id
				for (const key of Object.keys(x)) if (ID.test(key)) out.push(key);
			}
			refs(x, out, false);
		}
}

function check(dir: string): number {
	const set = load(dir);
	const errors = [...set.errors];
	for (let b = set.base; b; b = b.base)
		errors.push(...b.errors.map((e) => `(base ${basename(b.dir)}) ${e}`));
	for (const { file, el } of set.els) {
		const found: string[] = [];
		refs(el, found);
		for (const r of found) {
			if (!idSchema.safeParse(r).success)
				errors.push(`${file}: ${String(el.id ?? el.name)}: bad id ${r}`);
			else if (!resolves(set, r))
				errors.push(`${file}: ${String(el.id ?? el.name)}: ${r} does not resolve`);
		}
	}
	const counts = new Map<string, number>();
	for (const i of set.ids.keys()) counts.set(typeOf(i), (counts.get(typeOf(i)) ?? 0) + 1);
	const lists = set.els.filter((e) => e.file === 'legal-lists.json').length;
	console.log(`${basename(dir)}${set.base ? ` (base ${basename(set.base.dir)})` : ''}`);
	console.log(
		'  ' +
			[...counts.entries()]
				.sort()
				.map(([t, n]) => `${t} ${n}`)
				.join(', ') +
			`, legal-list ${lists}`
	);
	for (const e of errors) console.log(`  ERROR ${e}`);
	console.log(`  ${errors.length} error(s)`);
	return errors.length;
}

const dirs = process.argv.slice(2);
if (!dirs.length) {
	console.log('usage: node --experimental-strip-types scripts/rules-check.ts <rules folder> [...]');
	process.exit(2);
}
let total = 0;
for (const d of dirs) total += check(d.replace(/\/$/, ''));
process.exit(total ? 1 : 0);
