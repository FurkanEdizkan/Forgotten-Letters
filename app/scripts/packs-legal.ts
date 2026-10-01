/**
 * For every faction and variant in the book packs: the smallest warband the rules ask for (its leader and every
 * must-include, with their fixed kit) run through the builder's own checks. Prints what the builder would say about
 * it, so a pack that can't make a legal warband shows up before a player meets it.
 *
 *   node app/scripts/packs-legal.ts docs/packs/*.yaml
 */
import { readFileSync } from 'node:fs';
import { parseTemplate, type FactionPack } from '../src/lib/faction-template.ts';
import { FACTIONS } from '../src/lib/rules/factions.ts';
import { letters, readRules, unitKit, warbandIssues, type ModelState, type WarbandState } from '../src/lib/warband-rules.ts';

const known = { factions: [...FACTIONS.map((f) => ({ id: f.id, name: f.name })), { id: 'mercenaries', name: 'Mercenaries' }, { id: 'glossary', name: 'Glossary' }] };
const packs = process.argv
	.slice(2)
	.filter((f) => !/TEMPLATE/.test(f))
	.map((f) => parseTemplate(readFileSync(f, 'utf8'), known).pack)
	.filter((p): p is FactionPack => !!p);
const mercs = packs.find((p) => p.factionId === 'mercenaries');
let bad = 0;
for (const f of FACTIONS) {
	const base = packs.find((p) => p.factionId === f.id && !p.variant);
	if (!base) continue;
	for (const variant of [null, ...f.variants]) {
		const v = variant ? packs.find((p) => p.factionId === f.id && p.variant === variant) : null;
		if (variant && !v) {
			console.log(`- ${f.id} / ${variant}: no pack`);
			bad++;
			continue;
		}
		const rules = readRules(base.rules.text, v?.rules.text ?? null, [base.rules.overrides, v?.rules.overrides]);
		const replaced = new Set((v?.units ?? []).map((u) => letters(u.name)));
		const units = [...base.units.filter((u) => !replaced.has(letters(u.name))), ...(v?.units ?? []), ...(mercs?.units ?? [])].filter(
			(u) => !rules.excluded.some((x) => letters(x) === letters(u.name))
		);
		const find = (n: string) => units.find((u) => letters(u.name) === letters(n));
		const want: string[] = [];
		const leader = rules.leader ?? units.find((u) => u.keywords.some((k) => letters(k) === 'leader'))?.name ?? null;
		if (leader) want.push(leader);
		for (const m of rules.mustInclude) for (let i = want.filter((x) => letters(x) === letters(m.name)).length; i < m.n; i++) want.push(m.name);
		const models: ModelState[] = want.flatMap((n, i) => {
			const u = find(n);
			if (!u) return [];
			const kit = unitKit(u.battlekitNote, u.kit);
			return [{ id: `m${i}`, type: u.name, category: u.category, keywords: u.keywords, status: 'active', equipment: kit.fixed.map((x) => ({ name: x, cost: 0, currency: 'ducats' as const })), upgrades: [], kit }];
		});
		const spent = { ducats: 0, glory: 0 };
		for (const n of want) {
			const u = find(n);
			if (u) spent[u.currency] += u.cost;
		}
		const state: WarbandState = { models, stash: [], ducats: rules.startDucats - spent.ducats, glory: rules.startGlory - spent.glory, armoury: [], unrestricted: false };
		const entries = units.map((u) => ({ name: u.name, availabilityMax: u.availabilityMax }));
		const issues = [...want.filter((n) => !find(n)).map((n) => `${n}: no such unit`), ...warbandIssues(state, rules, entries as never)];
		const label = variant ? `${f.id} / ${variant}` : f.id;
		if (issues.length) bad++;
		console.log(`${issues.length ? '✗' : '✓'} ${label}: ${want.join(', ') || '(no leader, nothing required)'} · ${rules.startDucats} D ${rules.startGlory} G${issues.length ? `\n    ${issues.join('\n    ')}` : ''}`);
	}
}
process.exit(bad ? 1 : 0);
