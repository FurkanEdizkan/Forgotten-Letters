/**
 * Check book packs (Faction Studio YAML, docs/packs/*.yaml) before loading them: each must read cleanly, and every
 * item a unit names (fixed kit, swaps, per-entry prices, free items) must exist in its own pack, its faction's base
 * pack or the Mercenaries pack. A pack whose faction id is "glossary" carries keywords only. Prints a summary per pack and every problem; exits 1 if there are any.
 *
 *   npx --prefix app tsx app/scripts/packs-check.ts docs/packs/*.yaml
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseTemplate, type FactionPack } from '../src/lib/faction-template.ts';
import { FACTIONS } from '../src/lib/rules/factions.ts';
import { namesIn } from '../src/lib/warband-limits.ts';

const files = process.argv.slice(2);
if (!files.length) {
	console.error('usage: npx --prefix app tsx app/scripts/packs-check.ts docs/packs/*.yaml');
	process.exit(2);
}
const known = { factions: [...FACTIONS.map((f) => ({ id: f.id, name: f.name })), { id: 'mercenaries', name: 'Mercenaries' }] };
const packs: { file: string; pack: FactionPack }[] = [];
let problems = 0;
const say = (file: string, msg: string) => {
	problems++;
	console.log(`  ✗ ${basename(file)}: ${msg}`);
};

for (const file of files) {
	const { pack, errors } = parseTemplate(readFileSync(file, 'utf8'), known);
	for (const e of errors) say(file, `${e.path}: ${e.message}`);
	if (pack) packs.push({ file, pack });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const itemsOf = (pred: (p: FactionPack) => boolean) => new Set(packs.filter((x) => pred(x.pack)).flatMap((x) => x.pack.items.map((i) => norm(i.name))));
const mercs = itemsOf((p) => p.factionId === 'mercenaries');

for (const { file, pack } of packs) {
	const base = itemsOf((p) => p.factionId === pack.factionId && !p.variant);
	const own = new Set(pack.items.map((i) => norm(i.name)));
	const has = (name: string) => own.has(norm(name)) || base.has(norm(name)) || mercs.has(norm(name));
	for (const u of pack.units) {
		const k = u.kit;
		const named = [...(k?.fixed ?? []), ...(k?.swap ? [k.swap.from, k.swap.to] : []), ...Object.keys(k?.prices ?? {})];
		for (const n of named) if (!has(n)) say(file, `${u.name}: kit names "${n}", which no armoury here has`);
		if (!u.stats.movement && u.category !== 'mercenary') say(file, `${u.name}: no profile (stats)`);
	}
	for (const n of pack.rules.overrides?.freeItems ?? []) if (!has(n)) say(file, `rules.free_items: "${n}" is in no armoury here`);
	const label = pack.variant ? `${pack.factionId} / ${pack.variant}` : pack.factionId;
	console.log(
		`${basename(file)} (${label}): ${pack.units.length} units, ${pack.items.length} items, ${pack.keywords.length} keywords, ` +
			`${pack.rules.overrides?.upgrades?.length ?? 0} upgrades`
	);
}
// Names a rule points at must be something: a unit, an item, an upgrade, a keyword (or a faction, for hiring).
let warnings = 0;
const keywords = new Set(packs.flatMap((x) => [...x.pack.keywords.map((k) => norm(k.name.replace(/\s*\(.*$/, ''))), ...x.pack.units.flatMap((u) => u.keywords.map(norm))]));
for (const { file, pack } of packs) {
	if (pack.factionId === 'glossary') continue;
	// A shared pack (Glory Items, exploration finds) may name any faction's entries.
	const shared = ['glory-items', 'exploration', 'patrons'].includes(pack.factionId);
	const scope = packs.filter((x) => shared || (x.pack.factionId === pack.factionId && (!x.pack.variant || x.pack.variant === pack.variant))).map((x) => x.pack);
	const units = new Set([...scope.flatMap((p) => p.units.map((u) => norm(u.name))), ...packs.filter((x) => x.pack.factionId === 'mercenaries').flatMap((x) => x.pack.units.map((u) => norm(u.name)))]);
	const items = new Set(scope.flatMap((p) => p.items.map((i) => norm(i.name))));
	const ups = new Set(scope.flatMap((p) => (p.rules.overrides?.upgrades ?? []).map((u) => norm(u.name))));
	const known = (n: string) => {
		const k = norm(n);
		return units.has(k) || items.has(k) || ups.has(k) || keywords.has(k) || k === 'elite' || k === 'mercenaries' || [...units].some((u) => u.startsWith(k) || k.startsWith(u));
	};
	const o = pack.rules.overrides ?? {};
	const refs: [string, string][] = [
		...(o.leader ? [['leader', o.leader] as [string, string]] : []),
		...(o.mustInclude ?? []).map((m) => ['must_include', m.name] as [string, string]),
		...(o.caps ?? []).map((c) => ['caps', c.name] as [string, string]),
		...(o.excluded ?? []).map((e) => ['excluded', e] as [string, string]),
		...(o.upgrades ?? []).flatMap((u) => u.for.map((f) => [`upgrade ${u.name}.for`, f] as [string, string])),
		...pack.items.flatMap((i) => (i.stipulations?.only ?? []).map((n) => [`${i.name}.only`, n] as [string, string])),
		// Every name a limit or price points at (entries, items, upgrades, kit loadouts, counts_as).
		...[
			['rules', [o.limits, o.prices, (o.upgrades ?? []).map((u) => u.limits)]] as const,
			...pack.units.map((u) => [u.name, [u.kit?.limits, u.kit?.loadouts?.flat(2).map((n) => ({ names: [n] })), u.kit?.countsAs ? { entries: [u.kit.countsAs] } : null]] as const),
			...pack.items.map((i) => [i.name, [i.stipulations?.limits, i.stipulations?.limitExcludes]] as const),
			...(pack.patrons ?? []).flatMap((pt) => pt.skills.map((sk) => [`${pt.name}: ${sk.name}`, [sk.limits, sk.prices]] as const))
		].flatMap(([where, x]) => {
			const n = namesIn(x);
			return [...n.entries, ...n.items, ...n.upgrades].map((name) => [`${where} limits`, name] as [string, string]);
		})
	];
	for (const [where, n] of refs)
		if (!known(n)) {
			warnings++;
			console.log(`  ? ${basename(file)}: ${where} names "${n}", which is no unit, item, upgrade or keyword here`);
		}
}
if (warnings) console.log(`${warnings} name(s) to look at (not errors: a rule may name something outside the packs).`);
console.log(problems ? `\n${problems} problem(s).` : '\nAll packs read cleanly.');
process.exit(problems ? 1 : 0);
