/**
 * Runs a rules folder's legal lists through the warband engine, so every building rule is shown to bite:
 * each `legal` list must have no error (warnings are fine) and fit its starting money; each illegal list must raise
 * an issue containing its `expect`. Prints ✓ or ✗ per list; exits 1 if any is wrong.
 *
 *   cd app && node --experimental-strip-types scripts/rules-legal.ts ../rules/core-1.0.2 [more folders]
 *
 * A folder is `manifest.json` plus the files of `FILES` (a missing file is an empty list) and `pages/*.json`; an
 * expansion's `manifest.base` names a sibling folder, loaded first.
 *
 * Reused from archive/carcass-front-v1:app/scripts/packs-legal.ts, rewritten to ids and the rules folder format.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { FILES, rulesSet, type LegalList, type Unit } from '../src/lib/rules/pack.ts';
import {
	bestLine,
	issues,
	mergeSets,
	rating,
	resolveFaction,
	type SetWithBase,
	type WarbandState
} from '../src/lib/warbands/index.ts';

const KEYS: Record<string, string> = {
	'keywords.json': 'keywords',
	'items.json': 'items',
	'armoury-lines.json': 'armouryLines',
	'factions.json': 'factions',
	'variants.json': 'variants',
	'units.json': 'units',
	'upgrades.json': 'upgrades',
	'patrons.json': 'patrons',
	'tables.json': 'tables',
	'scenarios.json': 'scenarios',
	'legal-lists.json': 'legalLists'
};

const json = (p: string): unknown => JSON.parse(readFileSync(p, 'utf8'));

function load(dir: string, seen = new Set<string>()): SetWithBase {
	const at = resolve(dir);
	if (seen.has(at)) throw new Error(`${at}: its base chain loops.`);
	seen.add(at);
	const raw: Record<string, unknown> = { manifest: json(join(at, 'manifest.json')) };
	for (const file of Object.keys(FILES)) {
		const p = join(at, file);
		if (existsSync(p)) raw[KEYS[file]!] = json(p);
	}
	const pages = join(at, 'pages');
	if (existsSync(pages))
		raw.pages = readdirSync(pages)
			.filter((n) => n.endsWith('.json'))
			.flatMap((n) => json(join(pages, n)) as unknown[]);
	const parsed = rulesSet.safeParse(raw);
	if (!parsed.success) {
		const first = parsed.error.issues
			.slice(0, 10)
			.map((i) => `  ${i.path.join('.')}: ${i.message}`)
			.join('\n');
		throw new Error(`${basename(at)} does not match the rules format:\n${first}`);
	}
	const base = parsed.data.manifest.base;
	return base ? { ...parsed.data, base: load(join(dirname(at), base), seen) } : parsed.data;
}

/** A legal list as a warband: each model recruited, its listed kit bought on top of its unit's fixed kit. */
function build(set: SetWithBase, l: LegalList) {
	const variant = mergeSets(set).variants.find((v) => v.id === l.target);
	const factionId = variant?.faction ?? l.target;
	const f = resolveFaction(set, factionId, variant?.id);
	let n = 0;
	const problems: string[] = [];
	// A list names items; the warband holds lines. Take the best line, else any line of the item (so an excluded
	// item is reported as excluded), else say so.
	const lineOf = (unit: Unit | undefined, item: string) => {
		const id =
			bestLine(f, unit, item).line?.id ?? f.set.armouryLines.find((x) => x.item === item)?.id;
		if (!id) problems.push(`${unit?.name ?? 'A model'}: no armoury line for ${item}`);
		return id ? [id] : [];
	};
	const fighters = l.models.flatMap((m) => {
		const unit = f.idx.units.get(m.unit);
		const kit = (m.kit ?? []).flatMap((i) => lineOf(unit, i));
		return Array.from({ length: m.n ?? 1 }, () => ({
			id: `m${++n}`,
			unitId: m.unit,
			group: unit?.category ?? ('troop' as const),
			kit,
			upgrades: m.upgrades ?? [],
			skills: m.skills ?? [],
			injuries: [],
			xp: 0
		}));
	});
	const draft: WarbandState = {
		setId: f.set.manifest.id,
		name: l.name,
		factionId,
		...(variant ? { variantId: variant.id } : {}),
		...(l.patron ? { patronId: l.patron } : {}),
		...(l.dedication ? { dedication: l.dedication } : {}),
		ducatLimit: f.rules.startDucats,
		stashDucats: 0,
		unspentGlory: 0,
		fighters,
		stash: [],
		fireteams: [],
		locations: []
	};
	const spent = rating(draft, f);
	const state = {
		...draft,
		stashDucats: f.rules.startDucats - spent.ducats,
		unspentGlory: f.rules.startGlory - spent.glory
	};
	return { state, f, problems };
}

let checked = 0;
let wrong = 0;
for (const dir of process.argv.slice(2)) {
	let set: SetWithBase;
	try {
		set = load(dir);
	} catch (e) {
		console.log(`✗ ${dir}: ${(e as Error).message}`);
		wrong++;
		continue;
	}
	console.log(`# ${set.manifest.id} (${set.legalLists.length} lists)`);
	for (const l of set.legalLists) {
		checked++;
		let found: string[];
		try {
			const { state, f, problems } = build(set, l);
			const all = issues(state, f);
			found = [
				...problems,
				...(l.legal ? all.filter((i) => i.severity === 'error') : all).map((i) => i.text)
			];
		} catch (e) {
			found = [`(the engine failed: ${(e as Error).message})`];
		}
		const label = `${l.target}: ${l.name}`;
		if (l.legal) {
			if (found.length) wrong++;
			console.log(
				`${found.length ? '✗' : '✓'} ${label}${found.length ? `\n    ${found.join('\n    ')}` : ''}`
			);
		} else {
			const bites =
				!!l.expect && found.some((t) => t.toLowerCase().includes(l.expect!.toLowerCase()));
			if (!bites) wrong++;
			console.log(
				`${bites ? '✓' : '✗'} ${label} (refused)${bites ? '' : `\n    expected an issue with "${l.expect ?? ''}", got:\n    ${found.join('\n    ') || '(none)'}`}`
			);
		}
	}
}
console.log(`\n${checked} lists, ${wrong} wrong.`);
process.exit(wrong ? 1 : 0);
