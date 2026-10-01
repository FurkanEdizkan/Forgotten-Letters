#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, type Issue } from './check.ts';
import { loadProject, type Project } from './config.ts';
import { extract, type Facts } from './extract.ts';
import { generate } from './generate.ts';
import { renderJson, renderMap } from './map.ts';
import { loadModel, type Model } from './model.ts';
import { behind, changedFiles } from './status.ts';

const HELP = `atlas: a living architecture (LikeC4 model + the code it describes)

  atlas update          refresh the generated model and MAP.md; list what still needs a person's (or agent's) judgement
  atlas check [--strict] where the code and the model disagree (--strict: exit 1 if they do)
  atlas status [--brief] has this branch changed code without updating the model?
  atlas map             rewrite MAP.md and map.json only
  atlas extract         write the code facts to <model>/.atlas/facts.json
  atlas serve | build   the interactive site (LikeC4): live, or static into <model>/site
`;

const p = loadProject();
const [cmd = 'help', ...args] = process.argv.slice(2);
const modelRel = relative(p.root, p.modelDir).split('\\').join('/');
const cache = join(p.modelDir, '.atlas');
const genDir = join(p.modelDir, 'generated');
const write = (file: string, text: string) => (mkdirSync(dirname(file), { recursive: true }), writeFileSync(file, text));

const codeFiles = (f: Facts) =>
	new Set([...f.modules.map((m) => m.path), ...f.routes.flatMap((r) => r.files), ...f.tables.map((t) => t.file), ...f.services.map((s) => s.file)]);

/** The generated files as they should be, compared with what's on disk. */
function staleGenerated(facts: Facts, model: Model) {
	const want = generate(facts, model, p.config.extract.sveltekit);
	return Object.entries(want).filter(([f, text]) => !existsSync(join(genDir, f)) || readFileSync(join(genDir, f), 'utf8') !== text).map(([f]) => f);
}

function report(issues: Issue[], stale: string[]) {
	if (stale.length) console.log(`• generated model out of date (${stale.join(', ')}): run \`atlas update\``);
	for (const i of issues) console.log(`• ${i.message}`);
	if (!issues.length && !stale.length) console.log('✓ The model and the code agree.');
}

function todoText(issues: Issue[], features: string[]) {
	const lines = ['# Architecture to-do', '', 'Written by `atlas update`. Each item is a change to the curated model (`.c4` files).', ''];
	for (const i of issues) lines.push(`- [ ] ${i.todo}`);
	for (const f of features) lines.push(`- [ ] Review the feature view \`${f}\`: this branch changed code it walks through.`);
	if (lines.length === 4) lines.push('Nothing: the model and the code agree.');
	return lines.join('\n') + '\n';
}

async function update() {
	const facts = extract(p.root, p.config);
	write(join(cache, 'facts.json'), JSON.stringify(facts, null, 1));
	// Generated files hang from curated elements: read the curated model alone, so a renamed parent can't break it.
	const aside = join(cache, 'generated-prev');
	rmSync(aside, { recursive: true, force: true });
	if (existsSync(genDir)) renameSync(genDir, aside);
	let curated: Model;
	try {
		curated = await loadModel(p.modelDir);
	} catch (e) {
		if (existsSync(aside)) renameSync(aside, genDir);
		throw e;
	}
	rmSync(aside, { recursive: true, force: true });
	for (const [f, text] of Object.entries(generate(facts, curated, p.config.extract.sveltekit))) write(join(genDir, f), text);
	const model = await loadModel(p.modelDir);
	write(join(p.modelDir, 'MAP.md'), renderMap(model, facts, modelRel));
	write(join(p.modelDir, 'map.json'), renderJson(model));
	const issues = check(p.root, facts, model);
	const { files } = changedFiles(p.root, p.config.base);
	const b = behind(files, codeFiles(facts), modelRel, model);
	write(join(cache, 'todo.md'), todoText(issues, b?.features ?? []));
	console.log(`Updated ${modelRel}/generated/, ${modelRel}/MAP.md and map.json.`);
	if (issues.length || b?.features.length) {
		console.log(`\nStill to do in the model (${modelRel}/.atlas/todo.md):`);
		console.log(readFileSync(join(cache, 'todo.md'), 'utf8').split('\n').filter((l) => l.startsWith('- [ ]')).join('\n'));
	} else console.log('✓ The model and the code agree.');
}

async function status(brief: boolean) {
	const facts = extract(p.root, p.config);
	let model: Model;
	try {
		model = await loadModel(p.modelDir);
	} catch (e) {
		console.log(`Architecture model in ${modelRel}/ doesn't load: ${(e as Error).message.split('\n')[0]}. Run \`atlas check\`.`);
		return;
	}
	const { branch, files } = changedFiles(p.root, p.config.base);
	const b = behind(files, codeFiles(facts), modelRel, model);
	const stale = staleGenerated(facts, model);
	if (brief) {
		if (b) {
			const what = [...b.elements.map((e) => e.id), ...b.unowned].slice(0, 8).join(', ');
			console.log(`Architecture behind on ${branch}: code changed in ${what} without a model update. Read ${modelRel}/MAP.md, update the model, then run \`npm --prefix tools/atlas run update\`.`);
		} else if (stale.length) console.log(`Architecture: the generated model is out of date on ${branch}. Run \`npm --prefix tools/atlas run update\`.`);
		return;
	}
	console.log(`Branch ${branch} (against ${p.config.base}): ${files.length} changed files.`);
	if (!b) console.log('✓ No code changed without a model update.');
	else {
		console.log('Code changed while the model did not:');
		for (const e of b.elements) console.log(`• ${e.id} (${e.title}): ${e.files.join(', ')}`);
		for (const f of b.unowned) console.log(`• ${f}: no element owns it yet`);
		if (b.features.length) console.log(`Feature views to review: ${b.features.join(', ')}`);
	}
	if (stale.length) console.log(`• generated model out of date (${stale.join(', ')}): run \`atlas update\``);
}

function likec4(...a: string[]) {
	const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin', 'likec4');
	process.exit(spawnSync(bin, a, { stdio: 'inherit' }).status ?? 1);
}

switch (cmd) {
	case 'update':
		await update();
		break;
	case 'check': {
		const facts = extract(p.root, p.config);
		const model = await loadModel(p.modelDir);
		const issues = check(p.root, facts, model);
		const stale = staleGenerated(facts, model);
		report(issues, stale);
		if (args.includes('--strict') && (issues.length || stale.length)) process.exit(1);
		break;
	}
	case 'status':
		await status(args.includes('--brief'));
		break;
	case 'map': {
		const facts = extract(p.root, p.config);
		const model = await loadModel(p.modelDir);
		write(join(p.modelDir, 'MAP.md'), renderMap(model, facts, modelRel));
		write(join(p.modelDir, 'map.json'), renderJson(model));
		break;
	}
	case 'extract':
		write(join(cache, 'facts.json'), JSON.stringify(extract(p.root, p.config), null, 1));
		break;
	case 'serve':
		likec4('serve', p.modelDir, ...args);
		break;
	case 'build':
		// Hash routing and a relative base: the site opens from any static host, or straight from disk.
		likec4('build', p.modelDir, '-o', join(p.modelDir, 'site'), '--use-hash-history', '--base', './', '-t', p.config.title ?? 'Architecture', ...args);
		break;
	default:
		console.log(HELP);
}
