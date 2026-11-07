/**
 * Builds the "Trench Companion Preview" rules expansion (`rules/tc-preview/`, on carcass-front-1.0 and core-1.0.2)
 * from Trench Companion's own data: what TC changes between its Official and Preview versions is applied onto our
 * books' data, so TC's different naming and modelling cancel out and only real changes land. Inputs and output are
 * git-ignored (`docs/tc/*.json`, `rules/`); this file holds no rules text.
 *
 * Changes applied, per faction, variant and Sin ("group"):
 * - a model's stats, keywords and abilities (onto every unit that is that model);
 * - a model's cost, currency and limits in a group, or its being offered there or not (a variant gets its own
 *   replacing entry when only it changes; `adds` and `excludes` for availability);
 * - an armoury line's cost, currency and limit in a group, new lines, and lines no longer offered;
 * - upgrade prices, new upgrades and upgrades a model no longer has;
 * - new variants (The Great Hunger, The Red Brigade), with their rules as text;
 * - new items, keywords and units, with TC's text.
 * Not applied (listed in the log): skills, patrons, faction rule text of existing factions, TC's buying restrictions.
 *
 *     npx tsx scripts/tc-preview.ts          (from app/)
 * then check it: node --experimental-strip-types scripts/rules-check.ts ../rules/tc-preview
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
	ArmouryLine,
	Faction,
	Item,
	Keyword,
	RulesSet,
	Unit,
	Upgrade,
	Variant
} from '../src/lib/rules/pack.ts';
import { rulesSet } from '../src/lib/rules/pack.ts';
import { applyStat } from '../src/lib/warbands/progression.ts';
import {
	mergeSets,
	resolveFaction,
	type Resolved,
	type SetWithBase
} from '../src/lib/warbands/resolve.ts';
import { letters } from '../src/lib/warbands/types.ts';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'rules/tc-preview');
const TODAY = new Date().toISOString().slice(0, 10);
const log: string[] = [];
const note = (s: string) => log.push(s);

// ---------- inputs ----------
// TC's data is untyped JSON from its app, read field by field; typing all of it would not make it safer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tc = Record<string, any>;
const full = JSON.parse(readFileSync(join(ROOT, 'docs/tc/tc-rules-official-preview.json'), 'utf8'));
const changes = JSON.parse(
	readFileSync(join(ROOT, 'docs/tc/tc-preview-changes.json'), 'utf8')
).tables;
const DEF: Record<string, Tc[]> = full.def;
const PRE: Record<string, Tc[]> = full.pre;
const byId = (rows: Tc[]) => new Map(rows.map((r) => [r.id as string, r]));
const textOfId = new Map<string, Tc>();
for (const t of Object.values(changes) as { changed: Tc[] }[])
	for (const e of t.changed) textOfId.set(e.id, e);

function loadFolder(dir: string): RulesSet {
	const o: Record<string, unknown> = {};
	for (const f of readdirSync(dir))
		if (f.endsWith('.json'))
			o[f.replace('.json', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = JSON.parse(
				readFileSync(join(dir, f), 'utf8')
			);
	return rulesSet.parse(o);
}
const core = loadFolder(join(ROOT, 'rules/core-1.0.2'));
const cf: SetWithBase = { ...loadFolder(join(ROOT, 'rules/carcass-front-1.0')), base: core };
const base = mergeSets(cf);

// ---------- helpers ----------
const TRANSLIT: Record<string, string> = { ß: 'ss', æ: 'ae', ø: 'o', ı: 'i', ł: 'l', œ: 'oe' };
export const slug = (s: string) =>
	[...s.toLowerCase()]
		.map((c) => TRANSLIT[c] ?? c)
		.join('')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['`’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
const same = (a: string, b: string) => key(a) === key(b);
const stripAction = (s: string) =>
	s
		.replace(/\s+ACTION\b/i, '')
		.replace(/\s*\(.*?\)\s*/g, ' ')
		.trim();
/** Bigram similarity, for names TC spells differently (Fāris, Stoßtruppen). */
function sim(a: string, b: string) {
	const g = (s: string) => {
		const x = key(s);
		const out: string[] = [];
		for (let i = 0; i < x.length - 1; i++) out.push(x.slice(i, i + 2));
		return out;
	};
	const A = g(a);
	const B = g(b);
	if (!A.length || !B.length) return key(a) === key(b) ? 1 : 0;
	const pool = [...B];
	let hit = 0;
	for (const x of A) {
		const i = pool.indexOf(x);
		if (i >= 0) {
			hit++;
			pool.splice(i, 1);
		}
	}
	return (2 * hit) / (A.length + B.length);
}
function find<T extends { name: string }>(list: T[], ...names: string[]): T | undefined {
	for (const n of names) {
		const exact = list.find((x) => same(x.name, n));
		if (exact) return exact;
	}
	let best: T | undefined;
	let score = 0;
	for (const n of names)
		for (const x of list) {
			const s = sim(stripAction(x.name), stripAction(n));
			if (s > score) [best, score] = [x, s];
		}
	if (score >= 0.85) return best;
	// Singular and plural are the same entry ("Janissary" / "Janissaries").
	const plural = list.find((x) => names.some((n) => sameWords(x.name, n)));
	if (plural) return plural;
	// TC sometimes adds a word ("Yüzbaşı" → "Yüzbaşı Captain"): one name that starts the other.
	return list.find(
		(x) =>
			names.some((n) => key(n).startsWith(key(x.name)) || key(x.name).startsWith(key(n))) &&
			key(x.name).length >= 5
	);
}
/** A name for comparing: transliterated, ACTION and brackets dropped, letters and digits only. */
function key(s: string) {
	return slug(stripAction(s)).replace(/-/g, '');
}
/** The same name but for a plural word ("Blessings of the Serpent Moon" / "Blessing of …"). */
function sameWords(a: string, b: string) {
	const one = (s: string) =>
		slug(stripAction(s))
			.split('-')
			.map((w) => w.replace(/ies$/, 'y').replace(/(?<!s)s$/, ''))
			.join('');
	return one(a) === one(b);
}
const ownerPath = (owner: string) => owner.replace(/^(faction|variant):/, '');

/** TC's structured text as ours: paragraphs and `- ` list items, no markup. */
function textOf(desc: Tc[] | undefined): string {
	const flat = (d: Tc): string =>
		[d.content ?? '', ...((d.subcontent as Tc[] | undefined) ?? []).map(flat)].join(
			d.tags?.desc_type === 'table_row' ? ' | ' : ''
		);
	const out: string[] = [];
	for (const d of desc ?? []) {
		const s = flat(d).trim();
		if (!s) continue;
		out.push(
			d.tags?.desc_type === 'list'
				? s
						.split(/\n+/)
						.map((l) => `- ${l.trim()}`)
						.join('\n')
				: s
		);
	}
	return out.join('\n\n');
}

// ---------- TC model views ----------
const view = (V: Record<string, Tc[]>) => {
	const md = byId(V.modeldata);
	const mv = byId(V.modelvariantdata);
	const model = (id: string): { name: string; stats: Tc; kws: string[]; abs: string[] } | null => {
		if (md.has(id)) {
			const m = md.get(id)!;
			return { name: m.name, stats: m.stats ?? {}, kws: m.keywords ?? [], abs: m.abilities ?? [] };
		}
		const v = mv.get(id);
		if (!v) return null;
		const b = model(v.base_id);
		if (!b) return null;
		return {
			name: v.name,
			stats: { ...b.stats, ...(v.stats ?? {}) },
			kws: [
				...b.kws.filter((k) => !(v.cut_keywords ?? []).includes(k)),
				...(v.keywords ?? []).filter((k: string) => !b.kws.includes(k))
			],
			abs: [
				...b.abs.filter((a) => !(v.cut_abilities ?? []).includes(a)),
				...(v.new_abilities ?? [])
			]
		};
	};
	return {
		model,
		kw: byId(V.keyworddata),
		ab: byId(V.abilitydata),
		eq: byId(V.equipmentdata),
		up: byId(V.upgradedata),
		fv: byId(V.factionvariantdata),
		fa: byId(V.factiondata),
		modelRels: V.factionmodelrelationship,
		eqRels: V.factionequipmentrelationship,
		upRels: V.modelupgraderelationship,
		kitRels: V.modelequipmentrelationship,
		rules: byId(V.factionruledata)
	};
};
const D = view(DEF);
const P = view(PRE);

// ---------- groups: TC faction or variant → ours ----------
const OURFAC: Record<string, string> = {
	fc_ironsultanate: 'faction:iron-sultanate',
	fc_newantioch: 'faction:new-antioch',
	fc_trenchpilgrim: 'faction:trench-pilgrims',
	fc_hereticlegion: 'faction:heretic-legions',
	fc_cultoftheblackgrail: 'faction:black-grail',
	fc_courtofthesevenheadedserpent: 'faction:seven-headed-serpent',
	fc_cf_processionofthesacredaffliction: 'faction:procession-of-the-sacred-affliction',
	fc_cf_hereticnavalraiders: 'faction:heretic-naval-raiders'
};
const SINS: Record<string, string> = {
	cathedraofpride: 'pride',
	goldenseatofgreed: 'greed',
	fleshdivanoflust: 'lust',
	blackklismosofenvy: 'envy',
	hungeringthroneofgluttony: 'gluttony',
	ironcuruleofwrath: 'wrath',
	silkbedofsloth: 'sloth'
};
interface Group {
	tc: string;
	faction: string;
	variant?: string;
	/** Not in our books: made here. */
	created?: boolean;
	name: string;
}
const groups = new Map<string, Group>();
for (const [tc, f] of Object.entries(OURFAC))
	groups.set(tc, { tc, faction: f, name: P.fa.get(tc)?.name ?? f });
const newVariants: Variant[] = [];
for (const v of P.fv.values()) {
	const faction = OURFAC[v.base_id];
	if (!faction) continue;
	const part = v.id.split(/_f[vc]_/).pop()!;
	const ours = base.variants.filter((x) => x.faction === faction);
	let hit = SINS[part] ? ours.find((x) => x.id.endsWith('/' + SINS[part])) : undefined;
	hit ??= find(ours, v.name);
	if (!hit && faction === 'faction:heretic-legions' && /naval/i.test(v.name))
		hit = ours.find((x) => x.id.endsWith('naval-raiding-party'));
	if (hit) {
		groups.set(v.id, { tc: v.id, faction, variant: hit.id, name: hit.name });
		continue;
	}
	const id = `variant:${ownerPath(faction)}/${slug(v.name)}`;
	const full = textOfId.get(v.id) ?? v;
	const rules = ((full.rules ?? []) as string[])
		.map((r) => textOfId.get(r) ?? P.rules.get(r))
		.filter(Boolean)
		.map((r) => `## ${r!.name}\n\n${textOf(r!.description)}`);
	const variant: Variant = {
		id,
		faction,
		name: v.name,
		...(([textOf(full.description), ...rules].filter(Boolean).join('\n\n') || undefined) && {
			text: [textOf(full.description), ...rules].filter(Boolean).join('\n\n')
		})
	};
	newVariants.push(variant);
	groups.set(v.id, { tc: v.id, faction, variant: id, created: true, name: v.name });
	note(`variant new: ${id} (${v.name})`);
}

// ---------- the expansion being built ----------
const out = {
	units: new Map<string, Unit>(),
	items: new Map<string, Item>(),
	lines: new Map<string, ArmouryLine>(),
	upgrades: new Map<string, Upgrade>(),
	variants: new Map<string, Variant>(),
	factions: new Map<string, Faction>(),
	keywords: new Map<string, Keyword>()
};
for (const v of newVariants) out.variants.set(v.id, v);
const clone = <T>(x: T): T => structuredClone(x);
/** The current version of an element: ours as changed so far, else the base's. */
const unitOf = (id: string) => out.units.get(id) ?? base.units.find((u) => u.id === id);
function touchUnit(id: string) {
	if (!out.units.has(id)) out.units.set(id, clone(base.units.find((u) => u.id === id)!));
	return out.units.get(id)!;
}
function touchLine(id: string) {
	if (!out.lines.has(id)) out.lines.set(id, clone(base.armouryLines.find((l) => l.id === id)!));
	return out.lines.get(id)!;
}
function touchVariant(id: string) {
	if (!out.variants.has(id)) out.variants.set(id, clone(base.variants.find((v) => v.id === id)!));
	return out.variants.get(id)!;
}
function touchFaction(id: string) {
	if (!out.factions.has(id)) out.factions.set(id, clone(base.factions.find((f) => f.id === id)!));
	return out.factions.get(id)!;
}
const itemById = (id: string) => out.items.get(id) ?? base.items.find((i) => i.id === id);
const allItems = () => [...base.items.filter((i) => !out.items.has(i.id)), ...out.items.values()];

/** What a group offers in our data so far (the set as built, the variant overlay laid). */
function resolved(g: Group): Resolved {
	const set = mergeSets({
		manifest: { id: 'tmp', name: 'tmp', kind: 'expansion', version: '0', base: 'x' },
		keywords: [...out.keywords.values()],
		items: [...out.items.values()],
		armouryLines: [...out.lines.values()],
		factions: [...out.factions.values()],
		variants: [...out.variants.values()],
		units: [...out.units.values()],
		upgrades: [...out.upgrades.values()],
		patrons: [],
		tables: [],
		scenarios: [],
		legalLists: [],
		pages: [],
		base: cf
	} as SetWithBase);
	const fa = set.factions.find((f) => f.id === g.faction)!;
	const ded = fa.dedications?.find((d) => d.variant === g.variant);
	return ded
		? resolveFaction(set, g.faction, undefined, ded.key)
		: resolveFaction(set, g.faction, g.variant);
}

// ---------- keywords ----------
const kwIndex = () => [
	...base.keywords.filter((k) => !out.keywords.has(k.id)),
	...out.keywords.values()
];
function ourKw(tcId: string): string | null {
	const k = P.kw.get(tcId) ?? D.kw.get(tcId);
	if (!k) return null;
	const nm = String(k.name)
		.replace(/\(.*?\)|\[.*?\]|\+\/-/g, ' ')
		.trim();
	const hit = kwIndex().find(
		(x) =>
			same(x.name.replace(/\(.*?\)|\[.*?\]|\+\/-/g, ' '), nm) ||
			(x.aliases ?? []).some((a) => same(a, nm))
	);
	if (hit) return hit.id;
	const id = `kw:${slug(nm)}`;
	if (!out.keywords.has(id)) {
		const t = textOfId.get(tcId);
		out.keywords.set(id, { id, name: k.name, kind: 'tag', text: textOf(t?.description) || k.name });
		note(`keyword new: ${id}`);
	}
	return id;
}

// ---------- items ----------
const CAT: Record<string, Item['category']> = {
	ranged: 'ranged',
	melee: 'melee',
	grenade: 'grenade',
	armour: 'armour',
	shield: 'shield',
	equipment: 'equipment'
};
function itemType(e: Tc): Item['type'] {
	const c = e.category;
	if (c === 'armour') return 'Armour';
	if (c === 'shield') return 'Shield';
	if (c === 'grenade') return 'Grenade';
	const h = e.stats?.hands_ranged ?? e.stats?.hands_melee;
	if (c === 'ranged' || c === 'melee') return h === 1 ? '1-Handed' : '2-Handed';
	return 'Equipment';
}
/** Our item for a TC equipment entry, made from TC's when we have none. */
function ourItem(tcId: string): string | null {
	const e = P.eq.get(tcId) ?? D.eq.get(tcId);
	if (!e) return null;
	const old = D.eq.get(tcId)?.name;
	const hit = find(allItems(), e.name, ...(old ? [old] : []));
	if (hit) return hit.id;
	const id = `item:${slug(e.name)}`;
	if (!out.items.has(id)) {
		const t = textOfId.get(tcId);
		const kws = ((e.keywords ?? []) as string[])
			.map(ourKw)
			.filter((k): k is string => !!k)
			.map((kw) => ({ kw }));
		out.items.set(id, {
			id,
			name: e.name,
			category: CAT[e.category] ?? 'equipment',
			type: itemType(e),
			...(e.distance ? { range: `${e.distance}"` } : {}),
			keywords: kws,
			...(textOf(t?.description) ? { text: textOf(t?.description) } : {})
		});
		note(`item new: ${id}`);
	}
	return id;
}
/** An item's keywords and range as TC changed them between versions. */
for (const pe of P.eq.values()) {
	const de = D.eq.get(pe.id);
	if (!de) continue;
	const addK = (pe.keywords ?? []).filter((k: string) => !(de.keywords ?? []).includes(k));
	const delK = (de.keywords ?? []).filter((k: string) => !(pe.keywords ?? []).includes(k));
	const range = pe.distance !== de.distance;
	if (!addK.length && !delK.length && !range) continue;
	const hit = find(allItems(), pe.name, de.name);
	if (!hit) {
		note(`item change skipped (not ours): ${pe.name}`);
		continue;
	}
	const it = out.items.get(hit.id) ?? clone(hit);
	for (const k of addK) {
		const id = ourKw(k);
		if (id && !it.keywords.some((x) => x.kw === id)) it.keywords.push({ kw: id });
	}
	for (const k of delK) {
		const id = ourKw(k);
		if (id) it.keywords = it.keywords.filter((x) => x.kw !== id);
	}
	if (range) {
		if (pe.distance) it.range = `${pe.distance}"`;
		else delete it.range;
	}
	out.items.set(it.id, it);
	note(
		`item changed: ${it.id} (${[addK.length && 'keywords+', delK.length && 'keywords-', range && 'range'].filter(Boolean).join(', ')})`
	);
}

// ---------- units: a model's profile ----------
const ourAbilityText = new Map<string, string>();
for (const u of base.units)
	for (const a of u.abilities) ourAbilityText.set(letters(stripAction(a.name)), a.text);
const abilityText = (tcId: string, nm: string) =>
	textOf(textOfId.get(tcId)?.description) || ourAbilityText.get(letters(stripAction(nm))) || '';
/** TC tags that are not keywords in ours: ELITE and MERCENARY come from the entry's category. */
const TAGS = new Set(['kw_elite', 'kw_mercenary']);
const fmtDice = (n: number) => `${n >= 0 ? '+' : ''}${n} DICE`;
const isElite = (kws: string[]) => kws.includes('kw_elite');

/** A Preview variant model's base model (`md_desecratedsaint_lust` → `md_desecratedsaint`). */
const PMV = byId(PRE.modelvariantdata);
const baseModel = (modelId: string): string | undefined => PMV.get(modelId)?.base_id;
/** Every unit of ours that is this TC model, in any group that offers it. */
function unitsOfModel(modelId: string): Set<string> {
	const ids = new Set<string>();
	const names = [P.model(modelId)?.name, D.model(modelId)?.name].filter(Boolean) as string[];
	// A variant model new in Preview ("Desecrated Saint of Lust") is our variant's copy of the base entry.
	const bm = baseModel(modelId);
	const baseName = bm ? (P.model(bm)?.name ?? D.model(bm)?.name) : undefined;
	for (const r of [...P.modelRels, ...D.modelRels]) {
		if (r.model_id !== modelId) continue;
		for (const tc of r.faction_id as string[]) {
			const g = groups.get(tc);
			if (!g || g.created) continue;
			const f = resolved(g);
			const all = [...f.units, ...f.mercenaries];
			// By the base's name only onto the variant's own copy: never a faction entry or a shared Mercenary.
			const viaBase = baseName ? find(all, baseName) : undefined;
			const u =
				find(all, ...names) ?? (viaBase && viaBase.owner === g.variant ? viaBase : undefined);
			if (u) ids.add(u.id);
		}
	}
	return ids;
}
for (const id of new Set([...P.modelRels.map((r) => r.model_id as string)])) {
	// A variant model new in Preview is compared with its base model as Official had it.
	const bm = baseModel(id);
	const a = D.model(id) ?? (bm ? D.model(bm) : null);
	const b = P.model(id);
	if (!a || !b) continue;
	const statDelta = (['movement', 'ranged', 'melee', 'armour'] as const).filter(
		(s) => (a.stats[s] ?? 0) !== (b.stats[s] ?? 0)
	);
	const flies = (a.stats.movetype ?? 0) !== (b.stats.movetype ?? 0);
	// Fixed kit: TC's mandatory equipment for the model, Official (or its base's) against Preview.
	const kitOf = (V: ReturnType<typeof view>, mid: string) =>
		new Set(
			V.kitRels
				.filter((r) => (r.model_id as string[]).includes(mid))
				.flatMap((r) => (r.mandatory_equipment ?? []) as string[])
		);
	const kitA = kitOf(D, D.model(id) ? id : (bm ?? id));
	const kitB = kitOf(P, id);
	const addKit = [...kitB].filter((e) => !kitA.has(e));
	const delKit = [...kitA].filter((e) => !kitB.has(e));
	const baseChanged = (a.stats.base?.[0] ?? null) !== (b.stats.base?.[0] ?? null);
	const addK = b.kws.filter((k) => !a.kws.includes(k) && !TAGS.has(k));
	const delK = a.kws.filter((k) => !b.kws.includes(k) && !TAGS.has(k));
	const addA = b.abs.filter((x) => !a.abs.includes(x));
	const delA = a.abs.filter((x) => !b.abs.includes(x));
	// Kept but renamed (same TC id, another name): renamed in ours, text from TC when it has it.
	const renamed = b.abs.filter(
		(x) =>
			a.abs.includes(x) && D.ab.get(x) && P.ab.get(x) && !same(D.ab.get(x)!.name, P.ab.get(x)!.name)
	);
	if (
		!statDelta.length &&
		!flies &&
		!addKit.length &&
		!delKit.length &&
		!baseChanged &&
		!addK.length &&
		!delK.length &&
		!addA.length &&
		!delA.length &&
		!renamed.length
	)
		continue;
	const targets = unitsOfModel(id);
	// A model new in Preview differs from its base only where its variant does: never change a shared entry for it.
	if (!D.model(id))
		for (const uid of targets) if (!unitOf(uid)?.owner.startsWith('variant:')) targets.delete(uid);
	if (!targets.size) {
		note(`model change skipped (no unit of ours): ${b.name}`);
		continue;
	}
	for (const uid of targets) {
		const u = touchUnit(uid);
		for (const s of statDelta) {
			const d = (b.stats[s] ?? 0) - (a.stats[s] ?? 0);
			const was = u.stats[s];
			// A profile printing two values is left as printed.
			if (was && /\d.*\d/.test(was.replace(/^\d+"/, ''))) {
				note(`${uid}: ${s} change ${d} not applied to two-value "${was}"`);
				continue;
			}
			if (!was || !/\d/.test(was)) {
				// Ours prints none ("-"): take TC's value as it now is.
				const v = b.stats[s] ?? 0;
				u.stats[s] = s === 'movement' ? `${v}"` : s === 'armour' ? String(v) : fmtDice(v);
			} else {
				u.stats[s] = applyStat(was, d) ?? was;
				if (s !== 'movement' && s !== 'armour' && !/DICE/.test(u.stats[s] ?? ''))
					u.stats[s] = fmtDice(Number.parseInt(u.stats[s] ?? '0'));
			}
		}
		if (flies && u.stats.movement)
			u.stats.movement = u.stats.movement.replace(
				/\/\w+$/,
				b.stats.movetype === 1 ? '/Flying' : '/Infantry'
			);
		if (baseChanged && b.stats.base?.[0]) u.stats.base = `${b.stats.base[0]}mm`;
		if (addKit.length || delKit.length) {
			const drop = new Set(delKit.map(ourItem).filter(Boolean));
			const fixed = (u.kit.fixed ?? []).filter((x) => !drop.has(x));
			for (const e of addKit) {
				const it = ourItem(e);
				if (!it) note(`${uid}: fixed kit to add not found: ${P.eq.get(e)?.name ?? e}`);
				else if (!fixed.includes(it)) fixed.push(it);
			}
			if (fixed.length) u.kit = { ...u.kit, fixed };
			else delete u.kit.fixed;
		}
		for (const k of addK) {
			const kid = ourKw(k);
			if (kid && !u.keywords.some((x) => x.kw === kid)) u.keywords.push({ kw: kid });
		}
		for (const k of delK) {
			const kid = ourKw(k);
			if (kid) u.keywords = u.keywords.filter((x) => x.kw !== kid);
		}
		for (const x of delA) {
			const nm = (D.ab.get(x) ?? P.ab.get(x))?.name ?? x;
			const before = u.abilities.length;
			u.abilities = u.abilities.filter((ab) => !sameWords(ab.name, nm));
			if (u.abilities.length === before) note(`${uid}: ability to remove not found: ${nm}`);
		}
		for (const x of renamed) {
			const from = D.ab.get(x)!.name;
			const to = P.ab.get(x)!.name;
			const ab = u.abilities.find((y) => same(y.name, from));
			if (!ab) continue;
			ab.name = to;
			const t = textOf(textOfId.get(x)?.description);
			if (t) ab.text = t;
			note(`${uid}: ability renamed ${from} → ${to}`);
		}
		for (const x of addA) {
			const nm = P.ab.get(x)?.name ?? x;
			if (!u.abilities.some((ab) => same(ab.name, nm)))
				u.abilities.push({ name: nm, text: abilityText(x, nm) });
		}
		note(
			`unit profile: ${uid} (${[...statDelta, flies && 'movetype', (addKit.length || delKit.length) && 'fixed kit', baseChanged && 'base', addK.length && 'keywords+', delK.length && 'keywords-', addA.length && 'abilities+', delA.length && 'abilities-'].filter(Boolean).join(', ')})`
		);
	}
}

// ---------- units: offered where, at what cost ----------
type Offer = {
	cost: number;
	currency: 'ducats' | 'glory';
	min: number;
	max: number | null;
	rel: Tc;
};
const offers = (V: ReturnType<typeof view>, tcGroup: string) => {
	const m = new Map<string, Offer>();
	for (const r of V.modelRels)
		if ((r.faction_id as string[]).includes(tcGroup))
			m.set(r.model_id, {
				cost: r.cost,
				currency: r.cost_type === 1 ? 'glory' : 'ducats',
				min: r.warband_minimum || 0,
				max: (r.warband_maximum ?? 0) > 0 ? r.warband_maximum : null,
				rel: r
			});
	return m;
};
function newUnit(modelId: string, g: Group, o: Offer): Unit {
	const b = P.model(modelId)!;
	const owner = g.variant ?? g.faction;
	const id = `unit:${ownerPath(owner)}/${slug(b.name)}`;
	const kit = P.kitRels
		.filter((r) => (r.model_id as string[]).includes(modelId))
		.flatMap((r) => r.mandatory_equipment as string[]);
	const fixed = kit.map(ourItem).filter((x): x is string => !!x);
	const kitArmour = kit.reduce(
		(s, e) =>
			s +
			((P.eq.get(e)?.contextdata?.upgrade_stat?.upgrades ?? []) as Tc[])
				.filter((u) => u.stat === 'armour')
				.reduce((a, u) => a + (u.value ?? 0), 0),
		0
	);
	const unit: Unit = {
		id,
		owner,
		name: b.name,
		category: o.rel.mercenary ? 'mercenary' : o.rel.captain || isElite(b.kws) ? 'elite' : 'troop',
		availability: { min: o.min, max: o.max },
		cost: o.cost,
		currency: o.currency,
		stats: {
			movement: `${b.stats.movement ?? 6}"/${b.stats.movetype === 1 ? 'Flying' : 'Infantry'}`,
			// No value in TC (a dog's Ranged) prints as a dash, as the books do.
			ranged: b.stats.ranged == null ? '-' : fmtDice(b.stats.ranged),
			melee: b.stats.melee == null ? '-' : fmtDice(b.stats.melee),
			armour: String((b.stats.armour ?? 0) + kitArmour),
			...(b.stats.base?.[0] ? { base: `${b.stats.base[0]}mm` } : {})
		},
		keywords: b.kws
			.filter((k) => !TAGS.has(k))
			.map(ourKw)
			.filter((k): k is string => !!k)
			.map((kw) => ({ kw })),
		abilities: b.abs.map((x) => {
			const nm = P.ab.get(x)?.name ?? x;
			return { name: nm, text: abilityText(x, nm) };
		}),
		kit: fixed.length ? { fixed } : {}
	};
	const lore = textOfId.get(modelId);
	if (lore && textOf(lore.description)) unit.text = textOf(lore.description);
	out.units.set(id, unit);
	note(`unit new: ${id} (${b.name}, ${o.cost} ${o.currency})`);
	return unit;
}
/** Make a variant's own copy of a faction entry (a different cost there), replacing it in that variant. */
function variantCopy(u: Unit, variant: string, o: Offer): Unit {
	const id = `unit:${ownerPath(variant)}/${slug(u.name)}`;
	if (out.units.has(id) || base.units.some((x) => x.id === id)) return touchUnit(id);
	const copy = { ...clone(u), id, owner: variant };
	if (u.owner === 'faction:mercenaries') {
		copy.category = o.rel.captain ? 'elite' : 'troop';
		delete copy.hiredBy;
		out.units.set(id, copy);
		note(`unit from a Mercenary: ${id} (${u.id} stays hireable)`);
		return copy;
	}
	out.units.set(id, copy);
	const v = touchVariant(variant);
	v.replaces = [...(v.replaces ?? []).filter((r) => r.from !== u.id), { from: u.id, to: id }];
	note(`unit variant copy: ${id} replaces ${u.id}`);
	return copy;
}
// Factions first: a variant then only differs where it really does.
const order = [...groups.values()].sort((a, b) => Number(!!a.variant) - Number(!!b.variant));
/**
 * What Official offered a group: its own rows; for a book variant Official TC lacks (the Sins were a warband option
 * there, on the faction's roster), the faction's rows. Null for a variant made here.
 */
function official<T>(of: (V: ReturnType<typeof view>, tc: string) => Map<string, T>, g: Group) {
	if (g.created) return null;
	if (g.variant && !D.fv.has(g.tc)) {
		const tc = Object.keys(OURFAC).find((k) => OURFAC[k] === g.faction);
		return tc ? of(D, tc) : null;
	}
	return of(D, g.tc);
}
for (const g of order) {
	const pre = offers(P, g.tc);
	const def = official(offers, g);
	const f = resolved(g);
	const ours = [...f.units, ...f.mercenaries];
	for (const [mid, o] of pre) {
		const b = P.model(mid);
		if (!b) continue;
		const was = def?.get(mid);
		if (o.rel.mercenary) {
			if (!was || (was.cost === o.cost && was.currency === o.currency)) continue;
			const m = find(f.mercenaries, b.name);
			const cur = m && unitOf(m.id);
			if (!cur || (cur.cost === o.cost && cur.currency === o.currency)) continue;
			const t = touchUnit(cur.id);
			note(`mercenary: ${t.id}: ${t.cost} ${t.currency} → ${o.cost} ${o.currency}`);
			Object.assign(t, { cost: o.cost, currency: o.currency });
			continue;
		}
		if (
			was &&
			was.cost === o.cost &&
			was.currency === o.currency &&
			was.min === o.min &&
			was.max === o.max
		)
			continue;
		const u = find(ours, b.name, ...(D.model(mid)?.name ? [D.model(mid)!.name] : []));
		if (!u) {
			newUnit(mid, g, o);
			continue;
		}
		const cur = unitOf(u.id)!;
		if (
			cur.cost === o.cost &&
			cur.currency === o.currency &&
			cur.availability.min === o.min &&
			cur.availability.max === o.max
		)
			continue;
		const target =
			!g.variant || cur.owner === g.variant ? touchUnit(u.id) : variantCopy(cur, g.variant, o);
		const before = `${target.cost} ${target.currency} ${target.availability.min}-${target.availability.max ?? '∞'}`;
		Object.assign(target, {
			cost: o.cost,
			currency: o.currency,
			availability: { min: o.min, max: o.max }
		});
		note(
			`unit offer: ${target.id} in ${g.variant ?? g.faction}: ${before} → ${o.cost} ${o.currency} ${o.min}-${o.max ?? '∞'}`
		);
	}
	// No longer offered (or never, in a variant we made): an entry of ours that no offered model matches.
	const now = resolved(g);
	const mine = [...now.units, ...now.mercenaries];
	const matched = (V: ReturnType<typeof view>, m: Map<string, Offer>) =>
		new Set(
			[...m.keys()]
				.map((mid) => {
					const b = V.model(mid);
					return b ? find(mine, b.name)?.id : undefined;
				})
				.filter(Boolean) as string[]
		);
	const offeredNow = matched(P, pre);
	const offeredBefore = def ? matched(D, def) : null;
	for (const u of mine) {
		if (u.category === 'mercenary' || offeredNow.has(u.id)) continue;
		const madeHere = !base.units.some((x) => x.id === u.id);
		if (!madeHere && offeredBefore && !offeredBefore.has(u.id)) continue; // TC never listed it: modelling, not a change.
		if (g.variant) {
			const v = touchVariant(g.variant);
			v.excludes = [...new Set([...(v.excludes ?? []), u.id])];
		} else {
			const fa = touchFaction(g.faction);
			fa.excluded = [...new Set([...(fa.excluded ?? []), u.id])];
		}
		note(`unit withdrawn: ${u.id} from ${g.variant ?? g.faction}`);
	}
}

// ---------- armoury ----------
const lineOffers = (V: ReturnType<typeof view>, tcGroup: string) => {
	const m = new Map<
		string,
		{ cost: number; currency: 'ducats' | 'glory'; limit?: number; rel: Tc }
	>();
	// A row only some models may buy from (Red Brigade's dogs' grenades) is not imported: the open row wins.
	const restricted = (r: Tc) => !!r.contextdata?.faction_eq_restriction;
	for (const r of V.eqRels)
		if ((r.faction_id as string[]).includes(tcGroup)) {
			const k = `${r.equipment_id}|${r.costtype}`;
			const had = m.get(k);
			if (had && restricted(r) && !restricted(had.rel)) continue;
			m.set(k, {
				cost: r.cost,
				currency: r.costtype === 1 ? 'glory' : 'ducats',
				...(r.limit > 0 ? { limit: r.limit } : {}),
				rel: r
			});
		}
	return m;
};
/** `<faction>|<equipment>|<costtype>` the faction no longer sells: a variant that still does needs its own line. */
const withdrawnFromFaction = new Set<string>();
for (const g of order) {
	const pre = lineOffers(P, g.tc);
	const def = official(lineOffers, g);
	const owner = g.variant ?? g.faction;
	for (const [k, o] of pre) {
		const was = def?.get(k);
		const lost = !!g.variant && withdrawnFromFaction.has(`${g.faction}|${k}`);
		if (was && was.cost === o.cost && was.limit === o.limit && !lost) continue;
		const eqId = k.split('|')[0]!;
		const f = resolved(g);
		const e = P.eq.get(eqId);
		if (!e) continue;
		if (/\bownership\b/i.test(e.name)) {
			note(`line skipped (TC sells a model as kit; ours has it as a unit): ${e.name} in ${owner}`);
			continue;
		}
		const names = [e.name, D.eq.get(eqId)?.name].filter(Boolean) as string[];
		const itemIs = (l: ArmouryLine, fuzzy: boolean) =>
			l.currency === o.currency &&
			names.some((n) => {
				const it = itemById(l.item);
				if (!it) return false;
				if (same(it.name, n)) return true;
				// Spelling only: one name inside the other is another item (Machine Gun / Submachine Gun).
				const [a, b] = [key(it.name), key(n)];
				return fuzzy && !a.includes(b) && !b.includes(a) && sim(it.name, n) >= 0.85;
			});
		const hit = f.lines.find((l) => itemIs(l, false)) ?? f.lines.find((l) => itemIs(l, true));
		if (hit) {
			if (hit.cost === o.cost && hit.limit === o.limit) continue;
			let target: ArmouryLine;
			if (!/^(faction|variant):/.test(hit.owner)) {
				// A shared table's line (Exploration, a Glory table): the group gets its own line, the table stays.
				const id = `line:${ownerPath(owner)}:${hit.item.replace(/^item:/, '')}${o.currency === 'glory' ? '-glory' : ''}`;
				target = out.lines.get(id) ?? { ...clone(hit), id, owner };
				// Bought from the armoury, not found exploring.
				if (target.stipulations?.explorationOnly) {
					target.stipulations = { ...target.stipulations };
					delete target.stipulations.explorationOnly;
					if (!Object.keys(target.stipulations).length) delete target.stipulations;
				}
				out.lines.set(id, target);
			} else if (!g.variant || hit.owner === g.variant) target = touchLine(hit.id);
			else {
				const id = `line:${ownerPath(g.variant)}:${hit.item.replace(/^item:/, '')}`;
				target = out.lines.get(id) ?? { ...clone(hit), id, owner: g.variant };
				out.lines.set(id, target);
				const v = touchVariant(g.variant);
				v.replaces = [
					...(v.replaces ?? []).filter((r) => r.from !== hit.id),
					{ from: hit.id, to: id }
				];
			}
			const before = `${target.cost} ${target.currency} limit ${target.limit ?? '∞'}`;
			target.cost = o.cost;
			if (o.limit) target.limit = o.limit;
			else delete target.limit;
			note(
				`line: ${target.id} in ${owner}: ${before} → ${o.cost} ${o.currency} limit ${o.limit ?? '∞'}`
			);
			continue;
		}
		const item = ourItem(eqId);
		if (!item) continue;
		const id = `line:${ownerPath(owner)}:${item.replace(/^item:/, '')}${o.currency === 'glory' ? '-glory' : ''}`;
		if (!out.lines.has(id)) {
			out.lines.set(id, {
				id,
				owner,
				item,
				cost: o.cost,
				currency: o.currency,
				...(o.limit ? { limit: o.limit } : {})
			});
			const restricted =
				Object.keys(o.rel.contextdata ?? {}).length || (o.rel.options ?? []).length;
			note(
				`line new: ${id} (${o.cost} ${o.currency}${o.limit ? `, limit ${o.limit}` : ''})${restricted ? ' — TC restriction not imported' : ''}`
			);
		}
	}
	// Sold in Official, not in Preview (only where the group has Official rows of its own): withdrawn.
	if (def && !g.created && !(g.variant && !D.fv.has(g.tc)))
		for (const [k, o] of def) {
			if (pre.has(k)) continue;
			const e = D.eq.get(k.split('|')[0]!);
			const f = resolved(g);
			const line =
				e &&
				f.lines.find(
					(l) =>
						l.currency === o.currency &&
						/^(faction|variant):/.test(l.owner) &&
						same(itemById(l.item)?.name ?? '', e.name)
				);
			if (!line) continue;
			if (g.variant) {
				const v = touchVariant(g.variant);
				v.excludes = [...new Set([...(v.excludes ?? []), line.id])];
			} else {
				const fa = touchFaction(g.faction);
				fa.excluded = [...new Set([...(fa.excluded ?? []), line.id])];
				withdrawnFromFaction.add(`${g.faction}|${k}`);
			}
			note(`line withdrawn: ${line.id} from ${owner}`);
		}
	// A variant we made: drop the faction's lines it does not list.
	if (g.created && g.variant) {
		const f = resolved({ ...g, variant: undefined, created: false });
		const offered = [...pre.values()]
			.map((o) => P.eq.get(o.rel.equipment_id)?.name)
			.filter(Boolean) as string[];
		for (const l of f.lines) {
			if (!l.owner.startsWith('faction:')) continue;
			const it = itemById(l.item);
			if (it && !offered.some((n) => same(n, it.name) || sim(n, it.name) >= 0.85)) {
				const v = touchVariant(g.variant);
				v.excludes = [...new Set([...(v.excludes ?? []), l.id])];
			}
		}
	}
}

// ---------- upgrades ----------
for (const r of P.upRels) {
	const was = D.upRels.find((x) => x.id === r.id);
	const sameAsBefore =
		was &&
		was.cost === r.cost &&
		was.cost_type === r.cost_type &&
		JSON.stringify(was.model_id_set) === JSON.stringify(r.model_id_set);
	if (sameAsBefore) continue;
	const up = P.up.get(r.upgrade_id);
	if (!up) continue;
	const models = (r.model_id_set ?? []) as string[];
	if (!models.length) {
		note(`upgrade skipped (granted by a rule, not a model): ${up.name}`);
		continue;
	}
	for (const mid of models) {
		for (const uid of unitsOfModel(mid)) {
			const u = touchUnit(uid);
			const known = (u.upgrades ?? [])
				.map((id) => out.upgrades.get(id) ?? base.upgrades.find((x) => x.id === id))
				.filter((x): x is Upgrade => !!x);
			const hit = find(known, up.name);
			const currency = r.cost_type === 1 ? 'glory' : 'ducats';
			if (hit) {
				if (hit.cost === r.cost && hit.currency === currency) continue;
				const target = out.upgrades.get(hit.id) ?? clone(hit);
				note(`upgrade: ${hit.id} ${hit.cost} ${hit.currency} → ${r.cost} ${currency}`);
				Object.assign(target, { cost: r.cost, currency });
				out.upgrades.set(target.id, target);
				continue;
			}
			const id = `upgrade:${ownerPath(u.owner)}/${slug(up.name)}`;
			// An upgrade without `for` is open to every unit in the engine (checks.ts upgradeFor): name its units.
			const made = out.upgrades.get(id);
			if (made && !base.upgrades.some((x) => x.id === id))
				made.for = [...new Set([...(made.for ?? []), uid])];
			if (!out.upgrades.has(id) && !base.upgrades.some((x) => x.id === id)) {
				const t = textOfId.get(up.id);
				out.upgrades.set(id, {
					id,
					owner: u.owner,
					name: up.name,
					for: [uid],
					cost: r.cost,
					currency,
					...(r.warband_limit > 0 ? { max: r.warband_limit } : {}),
					...(textOf(t?.description) ? { text: textOf(t?.description) } : {})
				});
				note(`upgrade new: ${id} (${r.cost} ${currency})`);
			}
			u.upgrades = [...new Set([...(u.upgrades ?? []), id])];
		}
	}
}
for (const r of D.upRels) {
	if (P.upRels.some((x) => x.id === r.id)) continue;
	const up = D.up.get(r.upgrade_id);
	for (const mid of (r.model_id_set ?? []) as string[])
		for (const uid of unitsOfModel(mid)) {
			const u = touchUnit(uid);
			const before = (u.upgrades ?? []).length;
			u.upgrades = (u.upgrades ?? []).filter((id) => {
				const x = base.upgrades.find((y) => y.id === id);
				return !x || !up || !same(x.name, up.name);
			});
			if ((u.upgrades ?? []).length < before) note(`upgrade withdrawn: ${up?.name} from ${uid}`);
		}
}

// ---------- what is not imported ----------
for (const s of changes.skilldata.changed) note(`not imported (skill): ${s.name}`);
for (const r of changes.factionruledata.changed) {
	const forNew = [...P.fv.values()].some(
		(v) => groups.get(v.id)?.created && (v.rules ?? []).includes(r.id)
	);
	if (!forNew) note(`not imported (faction rule text): ${r.name}`);
}
for (const id of changes.factionruledata.removed)
	note(`not imported (faction rule removed): ${id}`);

// ---------- write ----------
const set = {
	manifest: {
		id: 'tc-preview',
		name: 'Preview',
		kind: 'expansion' as const,
		version: TODAY,
		base: 'carcass-front-1.0',
		notes: `Trench Companion's Preview rules as of ${TODAY}: what Preview changes from Official, laid over the 1.0.2 books and Carcass Front. Not an official release.`,
		preview: true
	},
	keywords: [...out.keywords.values()],
	items: [...out.items.values()],
	armouryLines: [...out.lines.values()],
	factions: [...out.factions.values()],
	variants: [...out.variants.values()],
	units: [...out.units.values()],
	upgrades: [...out.upgrades.values()]
};
rulesSet.parse({ ...set, patrons: [], tables: [], scenarios: [], legalLists: [] });
mkdirSync(OUT, { recursive: true });
const write = (f: string, v: unknown) =>
	writeFileSync(join(OUT, f), JSON.stringify(v, null, 1) + '\n');
write('manifest.json', set.manifest);
write('keywords.json', set.keywords);
write('items.json', set.items);
write('armoury-lines.json', set.armouryLines);
write('factions.json', set.factions);
write('variants.json', set.variants);
write('units.json', set.units);
write('upgrades.json', set.upgrades);
for (const f of ['patrons.json', 'tables.json', 'scenarios.json', 'legal-lists.json']) write(f, []);
writeFileSync(join(ROOT, 'rules/_build-log-tc-preview.txt'), log.join('\n') + '\n');
const count = (p: string) => log.filter((l) => l.startsWith(p)).length;
console.log(
	`rules/tc-preview: ${set.units.length} units, ${set.items.length} items, ${set.armouryLines.length} lines, ${set.upgrades.length} upgrades, ${set.variants.length} variants, ${set.factions.length} factions, ${set.keywords.length} keywords`
);
console.log(
	`log: ${log.length} lines; not imported: ${count('not imported')}; skipped: ${log.filter((l) => /skipped|not applied|not found/.test(l)).length}`
);
