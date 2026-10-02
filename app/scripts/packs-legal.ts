/**
 * For every faction and variant in the book packs, run warbands through the builder's own state and checks (every
 * limit of the faction, its entries, items, upgrades and Patron included):
 * - the example lists in `legal-lists*.yaml` next to the packs: each `legal` list must have no issue and fit the
 *   starting money; each `illegal` list must have an issue containing its `expect` (so every rule is shown to bite);
 * - where a faction or variant has no example, the smallest warband the rules ask for (its leader and every
 *   must-include, with their fixed kit).
 *
 *   npx --prefix app tsx app/scripts/packs-legal.ts docs/packs/*.yaml
 *
 * legal-lists*.yaml:  <faction id>[::<variant>]: { legal: [List], illegal: [List & { expect }] }
 *   List: { name?, patron?, models: [{ entry, kit?: [item], upgrades?: [name], skills?: [name], n? }] }
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { parseTemplate, type FactionPack, type ItemRow, type UnitRow } from '../src/lib/faction-template.ts';
import { FACTIONS } from '../src/lib/rules/factions.ts';
import { builderState, entryOf, type BuilderInput, type ModelData } from '../src/lib/builder-state.ts';
import { findPatron } from '../src/lib/patrons.ts';
import { entryPrice, letters, priceFor, readRules, recruitCheck, warbandIssues, type ArmouryItem } from '../src/lib/warband-rules.ts';

const files = process.argv.slice(2).filter((f) => !/TEMPLATE|legal-lists/.test(f));
const known = { factions: [...FACTIONS.map((f) => ({ id: f.id, name: f.name })), ...['mercenaries', 'glossary', 'patrons', 'glory-items', 'exploration', 'campaign'].map((id) => ({ id, name: id }))] };
const packs = files.map((f) => parseTemplate(readFileSync(f, 'utf8'), known).pack).filter((p): p is FactionPack => !!p);
const dir = files.length ? dirname(files[0]) : '.';
type Model = { entry: string; kit?: string[]; upgrades?: string[]; skills?: string[]; n?: number };
type List = { name?: string; patron?: string; models: Model[]; expect?: string };
// Every legal-lists*.yaml beside the packs, together: lists under the same key in several files add up.
const lists: Record<string, { legal?: List[]; illegal?: List[] }> = {};
for (const n of readdirSync(dir).filter((x) => /^legal-lists.*\.yaml$/.test(x)))
	for (const [k, v] of Object.entries((parse(readFileSync(join(dir, n), 'utf8')) ?? {}) as typeof lists)) {
		const to = (lists[k] ??= {});
		to.legal = [...(to.legal ?? []), ...(v?.legal ?? [])];
		to.illegal = [...(to.illegal ?? []), ...(v?.illegal ?? [])];
	}
const of = (id: string) => packs.filter((p) => p.factionId === id).flatMap((p) => p.items);
const mercs = packs.find((p) => p.factionId === 'mercenaries');
const patrons = packs.flatMap((p) => p.patrons ?? []);
const byName = <T extends { name: string }>(base: T[], over: T[]) => [...base.filter((x) => !over.some((y) => letters(y.name) === letters(x.name))), ...over];
const toItem = (i: ItemRow): ArmouryItem => ({ ...i });

let bad = 0;
let checked = 0;
for (const f of FACTIONS) {
	const base = packs.find((p) => p.factionId === f.id && !p.variant);
	if (!base) continue;
	for (const variant of [null, ...f.variants]) {
		const label = variant ? `${f.id} / ${variant}` : f.id;
		const v = variant ? packs.find((p) => p.factionId === f.id && p.variant === variant) : null;
		if (variant && !v) {
			console.log(`- ${label}: no pack`);
			bad++;
			continue;
		}
		const units: UnitRow[] = [...byName(base.units, v?.units ?? []), ...(mercs?.units ?? [])];
		const shared = [...of('glory-items'), ...of('exploration')].filter(
			(i) => (!i.stipulations?.alignment || i.stipulations.alignment === f.alignment) && (!i.stipulations?.factions?.length || i.stipulations.factions.some((x) => x === f.id || x === f.under))
		);
		// As the server builds it: a mercenary's own kit for that mercenary only; excluded items taken away.
		const carriers = (n: string) => (mercs?.units ?? []).filter((u) => [...(u.kit?.fixed ?? []), ...Object.keys(u.kit?.prices ?? {})].some((x) => letters(x) === letters(n))).map((u) => u.name);
		const mercKit = (mercs?.items ?? [])
			.filter((i) => carriers(i.name).length)
			.map((i) => ({ ...i, stipulations: { ...(i.stipulations ?? {}), only: i.stipulations?.only?.length ? i.stipulations.only : carriers(i.name) } }));
		const excludedNow = new Set(readRules(base.rules.text, v?.rules.text ?? null, [base.rules.overrides, v?.rules.overrides]).excluded.map(letters));
		// A shared item with a faction item's name stays beside it, named for its source (as the server does).
		const own = [...base.items, ...(v?.items ?? [])];
		const sharedNamed = shared.map((i) => (own.some((x) => letters(x.name) === letters(i.name)) ? { ...i, name: `${i.name} (${i.faction === 'glory-items' ? 'Glory Item' : 'Exploration'})` } : i));
		const armoury = byName(byName([...sharedNamed, ...mercKit], base.items), v?.items ?? [])
			.filter((i) => !excludedNow.has(letters(i.name)))
			.map(toItem);
		const input = (list: List | null, models: ModelData[], ducats: number, glory: number): BuilderInput => ({
			faction: { name: f.name, alignment: f.alignment, variant },
			rulesText: { faction: base.rules.text, variant: v?.rules.text ?? null, overrides: [base.rules.overrides, v?.rules.overrides ?? null] },
			profiles: units.map((u) => ({ ...u, kit: u.kit })),
			armoury,
			models,
			stash: [],
			ducats,
			glory,
			unrestricted: false,
			openExploration: true,
			fireteams: [],
			patron: list?.patron ? findPatron(patrons, list.patron) : null
		});
		const start = builderState(input(null, [], 0, 0)).rules;
		const find = (n: string) => units.find((u) => letters(u.name) === letters(n));

		const run = (list: List): string[] => {
			const problems: string[] = [];
			const models: ModelData[] = [];
			const spent = { ducats: 0, glory: 0 };
			const empty = builderState(input(list, [], 0, 0));
			for (const m of list.models)
				for (let k = 0; k < (m.n ?? 1); k++) {
					const u = find(m.entry);
					if (!u) {
						problems.push(`${m.entry}: no such unit`);
						continue;
					}
					// Recruited, or hired, as the builder would allow (money, caps and limits aside: those are the list's issues).
					const may = recruitCheck(entryOf({ ...u, kit: u.kit }), { ...empty.state, ducats: Infinity, glory: Infinity, limits: [] }, empty.rules, { name: f.name, alignment: f.alignment, variant });
					if (!may.ok) problems.push(`${m.entry}: ${may.reason}`);
					// Priced as the builder prices it, in order: its entry's first-recruit price, then each item's (free items,
					// first copies, Patron Skill discounts).
					const sofar = () => builderState(input(list, models, 0, 0)).state;
					const recruited = entryPrice({ name: u.name, cost: u.cost, currency: u.currency }, sofar());
					const fixedKit = (u.kit?.fixed ?? []).map((n) => ({ name: n, cost: 0, currency: 'ducats' as const }));
					const me: ModelData = { id: `m${models.length}`, type: u.name, name: '', category: u.category, status: 'active', profileId: u.id, equipment: fixedKit, upgrades: m.upgrades ?? [], cost: recruited.cost, currency: recruited.currency, skills: m.skills ?? [] };
					models.push(me);
					for (const n of m.kit ?? []) {
						const a = armoury.find((x) => letters(x.name) === letters(n));
						if (!a) problems.push(excludedNow.has(letters(n)) ? `${m.entry}: ${n} is excluded from this warband's armoury` : `${m.entry}: no item "${n}"`);
						else {
							const st = builderState(input(list, models, 0, 0));
							const held = [...st.state.models.flatMap((x) => x.equipment)];
							const free = st.rules.freeItems.some((x) => letters(x) === letters(a.name)) && !held.some((h) => letters(h.name) === letters(a.name));
							const p = priceFor(st.state.models.at(-1), a, st.state);
							me.equipment = [...me.equipment, { name: a.name, cost: free ? 0 : p.cost, currency: p.currency }];
						}
					}
					let cost = recruited.cost;
					for (const n of m.upgrades ?? []) {
						const up = empty.rules.upgrades.find((x) => letters(x.name) === letters(n));
						if (!up) problems.push(`${m.entry}: no upgrade "${n}"`);
						else if (up.currency === recruited.currency) cost += up.cost;
						else spent[up.currency] += up.cost;
					}
					me.cost = cost;
					spent[recruited.currency] += cost;
					for (const e of me.equipment) spent[e.currency] += e.cost;
				}
			const st = builderState(input(list, models, start.startDucats - spent.ducats, start.startGlory - spent.glory));
			return [...problems, ...warbandIssues(st.state, st.rules, units.map((u) => entryOf({ ...u, kit: u.kit })))];
		};

		const key = Object.keys(lists).find((k) => letters(k) === letters(`${f.id}::${variant ?? ''}`) || (!variant && letters(k) === letters(f.id)));
		const mine = key ? lists[key] : null;
		if (!mine?.legal?.length && !(start.requiresVariant && !variant)) {
			// No example: the smallest warband the rules ask for.
			const want: string[] = [];
			const leader = start.leader ?? units.find((u) => u.category !== 'mercenary' && !start.excluded.some((x) => letters(x) === letters(u.name)) && u.keywords.some((k) => letters(k) === 'leader'))?.name ?? null;
			if (leader) want.push(leader);
			for (const m of start.mustInclude) for (let i = want.filter((x) => letters(x) === letters(m.name)).length; i < m.n; i++) want.push(m.name);
			const issues = run({ models: want.map((entry) => ({ entry })) });
			checked++;
			if (issues.length) bad++;
			console.log(`${issues.length ? '✗' : '·'} ${label} (minimal, no example list): ${want.join(', ') || '(nothing required)'}${issues.length ? `\n    ${issues.join('\n    ')}` : ''}`);
		}
		for (const l of mine?.legal ?? []) {
			const issues = run(l);
			checked++;
			if (issues.length) bad++;
			console.log(`${issues.length ? '✗' : '✓'} ${label}: ${l.name ?? 'legal list'}${issues.length ? `\n    ${issues.join('\n    ')}` : ''}`);
		}
		for (const l of mine?.illegal ?? []) {
			const issues = run(l);
			checked++;
			const bites = !!l.expect && issues.some((i) => i.toLowerCase().includes(l.expect!.toLowerCase()));
			if (!bites) bad++;
			console.log(`${bites ? '✓' : '✗'} ${label}: refuses ${l.name ?? 'illegal list'}${bites ? '' : `\n    expected an issue with "${l.expect}", got:\n    ${issues.join('\n    ') || '(none)'}`}`);
		}
	}
}
console.log(`\n${checked} lists, ${bad} wrong.`);
process.exit(bad ? 1 : 0);
