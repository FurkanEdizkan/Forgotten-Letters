/**
 * Bringing a Trench Companion warband in: from its text export ("Export Warband → Full", any of its options), and
 * matching what came in (from text or from its JSON, see `fromTrenchCompanion`) to the books' entries, so each model
 * gets its profile, keywords and kit facts, and each item its armoury category. What doesn't match is kept as written
 * and reported, never dropped. Trench Companion's own costs are kept.
 */
import { FACTIONS } from './rules/factions';
import { KIND_OF } from './builder';
import { findItem, letters, priceFor, type ArmouryItem, type Upgrade } from './warband-rules';
import type { ProfileData } from './builder-state';
import type { Category, Currency, Item, RosterUnit, TcImport } from './roster';

// ---------------------------------------------------------------- the text export

/** "123 Ducats | 3 Glory", "123 D | 3 G", "6 Glory": each currency's amount. */
function costs(s: string) {
	const out = { ducats: 0, glory: 0 };
	for (const m of s.matchAll(/(\d+)\s*(ducats?|d\b|glory|g\b)/gi)) out[/^g/i.test(m[2]) ? 'glory' : 'ducats'] += Number(m[1]);
	return out;
}

/** A line without the export's decoration: headline marks, Discord bold, bullets and leading dots. */
const bare = (line: string) =>
	line
		.replace(/\*\*|__/g, '')
		.replace(/^\s*#+\s*|\s*#+\s*$/g, '')
		.replace(/^\s*(?:[•·▪◦*\-–]+|\.{2,})\s*/, '')
		.trim();

const SECTION: [RegExp, Category | 'stash' | 'fireteams' | 'other'][] = [
	[/^elites?$/i, 'elite'],
	[/^troops?$/i, 'troop'],
	[/^mercenar(y|ies)$/i, 'mercenary'],
	[/^(stash|arsenal|strongbox)$/i, 'stash'],
	[/^fire\s*teams?$/i, 'fireteams'],
	[/^(exploration|notes|campaign)$/i, 'other']
];

/** Our faction (and variant) for a name Trench Companion prints: a faction's or a variant's. */
export function factionByName(name: string | null | undefined) {
	const n = letters(name ?? '');
	if (!n) return { faction: null, variant: null };
	for (const f of FACTIONS) {
		const v = f.variants.find((v) => letters(v) === n);
		if (v) return { faction: f.id, variant: v };
		if (letters(f.name) === n || letters(f.name).endsWith(n) || n.endsWith(letters(f.name))) return { faction: f.id, variant: null };
	}
	return { faction: null, variant: null };
}

/** A warband as `toTcText` writes it. */
export interface TextWarband {
	name: string;
	/** The variant's name, else the faction's (what Trench Companion prints as the Faction). */
	faction: string;
	patron: string | null;
	ducats: number;
	glory: number;
	units: { id: string; name: string; type: string; category: Category; cost: number; currency: 'ducats' | 'glory'; experience: number; status: string; equipment: Item[]; upgrades: string[]; skills: string[]; injuries: string[] }[];
	stash: Item[];
	fireteams: { name: string; members: string[] }[];
}

/** A warband in Trench Companion's "Full" text layout, which `fromTcText` (and Trench Companion's readers) take back. */
export function toTcText(w: TextWarband): string {
	const priced = (d: number, g: number) => `${d} Ducats | ${g} Glory`;
	const totalOf = (u: TextWarband['units'][number]) => {
		const t = { ducats: u.currency === 'ducats' ? u.cost : 0, glory: u.currency === 'glory' ? u.cost : 0 };
		for (const e of u.equipment) t[e.currency] += e.cost;
		return t;
	};
	const active = w.units.filter((u) => u.status !== 'dead');
	const rating = active.filter((u) => u.status === 'active').reduce((r, u) => ((r.ducats += totalOf(u).ducats), (r.glory += totalOf(u).glory), r), { ducats: 0, glory: 0 });
	const out = [`## ${w.name} ##`, '', `Faction: ${w.faction}`, `Rating: ${priced(rating.ducats, rating.glory)}`, ...(w.patron ? [`Patron: ${w.patron}`] : [])];
	for (const [cat, title] of [['elite', 'Elites'], ['troop', 'Troops'], ['mercenary', 'Mercenaries']] as const) {
		const us = active.filter((u) => u.category === cat);
		if (!us.length) continue;
		out.push('', `## ${title} ##`);
		for (const u of us) {
			const t = totalOf(u);
			out.push('', `**${u.name && u.name !== u.type ? `${u.name} (${u.type})` : u.type}**`, `• Cost: ${priced(t.ducats, t.glory)}`);
			if (u.upgrades.length) out.push(`• Upgrades & Choices: ${u.upgrades.join(', ')}`);
			out.push(`• Battlekit: ${u.equipment.map((e) => e.name).join(', ')}`);
			if (u.experience) out.push(`• Experience: ${u.experience}`);
			if (u.skills.length) out.push(`• Skills: ${u.skills.join(', ')}`);
			if (u.injuries.length) out.push(`• Injuries: ${u.injuries.join(', ')}`);
			if (u.status !== 'active') out.push(`• Status: ${u.status === 'retired' ? 'Retired' : 'Dead'}`);
		}
	}
	out.push('', '## Stash ##', '', `Stashed Ducats: ${w.ducats}`, `Unspent Glory: ${w.glory}`);
	if (w.stash.length) out.push(`Battlekit: ${w.stash.map((s) => s.name).join(', ')}`);
	const teams = w.fireteams.filter((f) => f.members.length);
	if (teams.length) {
		out.push('', '## Fireteams ##');
		for (const f of teams) out.push('', f.name, ...f.members.map((id) => `• ${w.units.find((u) => u.id === id)?.type ?? '?'}`));
	}
	return out.join('\n') + '\n';
}

/** Read Trench Companion's text export (Full, Compact or TTS Text, with any options). */
export function fromTcText(text: string): TcImport {
	const lines = text.split(/\r?\n/);
	let name = '';
	let factionName: string | null = null;
	let patron: string | null = null;
	let section: (typeof SECTION)[number][1] | null = null;
	let ducats = 0;
	let glory = 0;
	const units: RosterUnit[] = [];
	const stash: Item[] = [];
	const fireteams: { name: string; members: string[] }[] = [];
	let cur: RosterUnit | null = null;
	const list = (s: string) =>
		s
			.split(/,(?![^(]*\))/)
			.map((x) => x.trim().replace(/\s+’/g, '’'))
			.filter(Boolean);

	for (const raw of lines) {
		const line = bare(raw);
		if (!line || /^-{3,}/.test(line) || /^view online/i.test(line) || /^https?:\/\//.test(line)) continue;
		const heading = /^\s*#/.test(raw) || /^\s*\*\*.*\*\*\s*$/.test(raw);
		const sec = SECTION.find(([re]) => re.test(line.replace(/:$/, '')));
		if (sec) {
			section = sec[1];
			cur = null;
			continue;
		}
		const label = /^([A-Za-z &]+):\s*(.*)$/.exec(line);
		if (!section) {
			// The head: the list's name, then its faction, rating and patron.
			if (label && /^faction$/i.test(label[1])) factionName = label[2].trim();
			else if (label && /^patron$/i.test(label[1])) patron = label[2].trim();
			else if (label && /^rating$/i.test(label[1])) continue;
			else if (!name) name = line;
			continue;
		}
		if (section === 'stash') {
			if (label && /ducats/i.test(label[1])) ducats = Number(label[2].match(/\d+/)?.[0] ?? 0);
			else if (label && /glory/i.test(label[1])) glory = Number(label[2].match(/\d+/)?.[0] ?? 0);
			else for (const n of list(label ? label[2] : line)) stash.push({ name: n, kind: 'equipment', cost: 0, currency: 'ducats' });
			continue;
		}
		if (section === 'fireteams') {
			const bullet = /^\s*(?:[•·▪◦*\-–]|\.{2,})/.test(raw);
			// Trench Companion names every fireteam alike ("New Antioch Fireteam"): number the repeats.
			if (!bullet) {
				const same = fireteams.filter((f) => f.name === line || f.name.startsWith(`${line} `)).length;
				fireteams.push({ name: same ? `${line} ${same + 1}` : line, members: [] });
			}
			else fireteams.at(-1)?.members.push(line);
			continue;
		}
		if (section === 'other') continue;
		// A model: its name line, then labelled lines (some exports put the cost on the name line).
		if (label && cur) {
			const [, key, value] = label;
			if (/cost/i.test(key)) cur.tcTotal = costs(value);
			else if (/battlekit|equipment|kit/i.test(key)) cur.equipment = list(value).map((n) => ({ name: n, kind: 'equipment', cost: 0, currency: 'ducats' }));
			else if (/upgrade|choice/i.test(key)) cur.upgrades = list(value);
			else if (/skill|advance/i.test(key)) cur.skills = list(value);
			else if (/injur|scar/i.test(key)) cur.injuries = list(value);
			else if (/xp|experience/i.test(key)) cur.experience = Number(value.match(/\d+/)?.[0] ?? 0);
			else if (/status/i.test(key)) cur.status = /dead/i.test(value) ? 'dead' : /retir/i.test(value) ? 'retired' : 'active';
			continue;
		}
		if (!heading && label === null && cur && /^\d/.test(line)) continue;
		const inline = /^(.*?)\s*[-–—|]\s*(\d.*)$/.exec(line);
		const title = (inline ? inline[1] : line).trim();
		// "Brother Anselm (Trench Cleric)": a fighter's own name, then the entry.
		const named = /^(.+?)\s*\((.+)\)$/.exec(title);
		cur = {
			name: named ? named[1] : title,
			type: named ? named[2] : title,
			category: section,
			leader: false,
			cost: 0,
			currency: 'ducats',
			experience: 0,
			equipment: [],
			upgrades: [],
			skills: [],
			injuries: [],
			stats: {},
			status: 'active',
			...(inline ? { tcTotal: costs(inline[2]) } : {})
		};
		units.push(cur);
	}

	// Fireteam members are named by entry: take each model once, in list order.
	const used = new Set<number>();
	const teams = fireteams.map((f) => ({
		name: f.name,
		members: f.members.flatMap((m) => {
			const i = units.findIndex((u, k) => !used.has(k) && (letters(u.type) === letters(m) || letters(u.name) === letters(m)));
			if (i < 0) return [];
			used.add(i);
			return [i];
		})
	}));
	const { faction, variant } = factionByName(factionName);
	return { name: name || 'Imported warband', ducats, glory, units, stash, faction, variant, sourceFaction: factionName, fireteams: teams, patron };
}

/** A Trench Companion export as pasted or uploaded: its JSON, or its text. */
export function readTcExport(text: string, fromJson: (raw: unknown) => TcImport): TcImport {
	const t = text.trim();
	if (t.startsWith('{') || t.startsWith('[')) return fromJson(JSON.parse(t));
	const imp = fromTcText(t);
	if (!imp.units.length) throw new Error('No models found: paste the whole "Export Warband" text (Full) or its JSON.');
	return imp;
}

// ---------------------------------------------------------------- matching to the books

export interface MatchReport {
	/** Models whose entry isn't in this faction's (or the mercenaries') book entries. */
	units: string[];
	/** Battlekit that isn't in the armoury. */
	items: { unit: string; item: string }[];
	/** Upgrades the variant doesn't have. */
	upgrades: { unit: string; upgrade: string }[];
	/** Where the books' prices don't add up to Trench Companion's for a model (text exports). */
	costs: string[];
}

export interface Book {
	profiles: ProfileData[];
	armoury: ArmouryItem[];
	upgrades: Upgrade[];
	/** The variant's leader entry, if it names one. */
	leader?: string | null;
	/** The faction's and variant's rules as paragraphs ("* Lector: … must include 1 Trench Cleric …"). */
	paragraphs?: string[];
}

const kindOf = (category: ArmouryItem['category']) => KIND_OF[category] as Item['kind'];

/** A model by name: exactly, else the longest entry name inside it, or it inside an entry's name. */
function byName(type: string, profiles: ProfileData[]) {
	const t = letters(type);
	if (!t) return null;
	return (
		profiles.find((p) => letters(p.name) === t) ??
		profiles.filter((p) => t.includes(letters(p.name)) || letters(p.name).includes(t)).sort((a, b) => b.name.length - a.name.length)[0] ??
		null
	);
}

/**
 * The entry a Trench Companion model is: by its name, else by Trench Companion's own id for it, else by a rule of
 * that name ("* Lector: … must include 1 Trench Cleric"): the first entry that rule names.
 */
function entryFor(u: RosterUnit, book: Book) {
	const found = byName(u.type, book.profiles) ?? (u.aliases ?? []).map((a) => byName(a, book.profiles)).find(Boolean);
	if (found) return found;
	const rule = (book.paragraphs ?? []).flatMap((p) => p.split('\n')).find((p) => letters(p.replace(/^\*\s*/, '').split(':')[0]) === letters(u.type));
	if (!rule) return null;
	return (
		book.profiles
			.map((p) => ({ p, at: rule.toLowerCase().indexOf(p.name.toLowerCase()) }))
			.filter((x) => x.at > 0)
			.sort((a, b) => a.at - b.at)[0]?.p ?? null
	);
}

/**
 * Match an import to the book: each model to its entry (profile, stats, the entry's own name and category), each item
 * to the armoury (its category; a text export's items take the entry's or the armoury's price, fixed kit free), and
 * each upgrade to the variant's. A text export's model cost is what's left of Trench Companion's total once its kit
 * is paid, so the warband's totals stay Trench Companion's.
 */
export function matchToBook(imp: TcImport, book: Book): { imported: TcImport; report: MatchReport } {
	const report: MatchReport = { units: [], items: [], upgrades: [], costs: [] };
	const units = imp.units.map((u) => {
		const p = entryFor(u, book);
		if (!p) report.units.push(u.type);
		const fixed = new Set((p?.kit?.fixed ?? []).map(letters));
		const equipment = u.equipment.map((e) => {
			const a = findItem(book.armoury, e.name);
			if (!a) {
				report.items.push({ unit: u.name, item: e.name });
				return e;
			}
			if (!u.tcTotal) return { ...e, name: a.name, kind: kindOf(a.category) };
			// A mercenary's kit comes with it (it is never bought); fixed kit is free.
			const priced = p?.category === 'mercenary' || fixed.has(letters(a.name)) ? { ...a, cost: 0 } : priceFor(p ? { kit: { fixed: [], swap: null, except: [], nothingElse: false, ...(p.kit ?? {}) } } : null, a);
			return { name: a.name, kind: kindOf(a.category), cost: priced.cost, currency: priced.currency as Currency };
		});
		const upgrades = u.upgrades.map((n) => {
			// Whole ("Swiss Guard (Lieutenant)" is its own upgrade in Papal States), else without the bracket.
			const plain = n.replace(/\s*\([^)]*\)\s*$/, '');
			const up = book.upgrades.find((x) => letters(x.name) === letters(n)) ?? book.upgrades.find((x) => letters(x.name) === letters(plain));
			if (!up && !(p?.kit?.swap && letters(p.kit.swap.to) === letters(n))) report.upgrades.push({ unit: u.name, upgrade: n });
			return up?.name ?? n;
		});
		let cost = u.cost;
		let currency = p?.currency ?? u.currency;
		if (u.tcTotal) {
			const paid = { ducats: 0, glory: 0 };
			for (const e of equipment) paid[e.currency] += e.cost;
			cost = Math.max(0, u.tcTotal[currency] - paid[currency]);
			const other: Currency = currency === 'glory' ? 'ducats' : 'glory';
			if (paid[other] !== u.tcTotal[other])
				report.costs.push(`${u.name}: the books' prices give ${paid[other]} ${other} of kit; Trench Companion has ${u.tcTotal[other]}.`);
		}
		const category: Category = p?.category ?? u.category;
		return {
			...u,
			type: p?.name ?? u.type,
			category,
			profileId: p?.id ?? null,
			stats: p?.stats ?? u.stats,
			leader: u.leader || (!!book.leader && letters(book.leader) === letters(p?.name ?? '')),
			cost,
			currency,
			equipment,
			upgrades
		};
	});
	const stash = imp.stash.map((s) => {
		const a = findItem(book.armoury, s.name);
		if (!a) report.items.push({ unit: 'Arsenal', item: s.name });
		return a ? { ...s, name: a.name, kind: kindOf(a.category), ...(s.cost ? {} : { cost: a.cost, currency: a.currency as Currency }) } : s;
	});
	return { imported: { ...imp, units, stash }, report };
}
