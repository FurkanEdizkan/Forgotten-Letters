/**
 * Trench Companion's "Full" text export, both ways: `toText` writes a warband in its layout (which Trench
 * Companion and Discord readers take), `fromText` reads its text back (Full, compact or plain, with or without the
 * Discord marks) and matches the names to the rules set.
 *
 * Reused from archive/carcass-front-v1:app/src/lib/tc-import.ts (toTcText, fromTcText), rewritten to ids and the
 * rules folder format.
 */
import { matchNamed, type Named, type NamedFighter } from './match.ts';
import { fighterCosts, rating } from './prices.ts';
import { nameOf, type Resolved, type SetWithBase } from './resolve.ts';
import { rowOf } from './progression.ts';
import type { Fighter, Group, Options, Price, WarbandState } from './types.ts';

const TITLES: [Group, string][] = [
	['elite', 'Elites'],
	['troop', 'Troops'],
	['mercenary', 'Mercenaries'],
	['special', 'Special'],
	['dead', 'Dead']
];
const priced = (p: Price) => `${p.ducats} Ducats | ${p.glory} Glory`;

/** A skill's or injury's name: the Patron Skill's, the table row's, else the text as kept. */
export function refName(f: Resolved, ref: string) {
	if (ref.startsWith('skill:')) return nameOf(f, ref);
	return rowOf(ref, f.set.tables)?.row.name ?? ref;
}

export const fighterLabel = (f: Resolved, x: Fighter) => {
	const unit = nameOf(f, x.unitId);
	return x.name ? `${unit} - ${x.name}` : unit;
};

/** The warband in Trench Companion's Full text layout. */
export function toText(state: WarbandState, f: Resolved, opts?: Options): string {
	const costs = fighterCosts(state, f, opts);
	// The dead are off the table, so off the rating; their own cost is still shown.
	const costOf = (x: Fighter) =>
		costs.get(x.id) ??
		fighterCosts({ ...state, fighters: [{ ...x, group: 'troop' }] }, f, opts).get(x.id) ?? {
			ducats: 0,
			glory: 0
		};
	const out = [
		`## ${state.name ?? 'Warband'} ##`,
		`Faction: ${f.name}`,
		`Rating: ${priced(rating(state, f, opts))}`
	];
	if (state.patronId) out.push(`Patron: ${nameOf(f, state.patronId)}`);
	for (const [group, title] of TITLES) {
		const xs = state.fighters.filter((x) => x.group === group);
		if (!xs.length) continue;
		out.push('', `## ${title} ##`);
		for (const x of xs) {
			const unit = f.idx.units.get(x.unitId);
			const kit = [...(unit?.kit.fixed ?? []), ...x.kit].map((i) => nameOf(f, i));
			out.push('', fighterLabel(f, x), `• Cost: ${priced(costOf(x))}`);
			if (x.upgrades.length)
				out.push(`• Upgrades & Choices: ${x.upgrades.map((u) => nameOf(f, u)).join(', ')}`);
			if (kit.length) out.push(`• Battlekit: ${kit.join(', ')}`);
			if (x.skills.length) out.push(`• Skills: ${x.skills.map((s) => refName(f, s)).join(', ')}`);
			if (x.injuries.length)
				out.push(`• Injuries: ${x.injuries.map((s) => refName(f, s)).join(', ')}`);
		}
	}
	out.push(
		'',
		'## Stash ##',
		`Stashed Ducats: ${state.stashDucats}`,
		`Unspent Glory: ${state.unspentGlory}`
	);
	if (state.stash.length) out.push(state.stash.map((i) => nameOf(f, i)).join(', '));
	const label = (id: string) => {
		const x = state.fighters.find((y) => y.id === id);
		return x ? fighterLabel(f, x) : id;
	};
	if (state.fireteams.length) {
		out.push('', '## Fireteams ##');
		state.fireteams.forEach((t, i) =>
			out.push(`Fireteam ${i + 1}`, ...t.map((id) => `• ${label(id)}`))
		);
	}
	if (state.locations.length) {
		out.push('', '## Locations ##');
		for (const l of state.locations)
			out.push(
				l.name,
				...(l.note ?? '')
					.split('\n')
					.filter(Boolean)
					.map((n) => `• ${n}`)
			);
	}
	return `${out.join('\n')}\n`;
}

type Section = Group | 'stash' | 'fireteams' | 'locations' | 'other';
const SECTIONS: [RegExp, Section][] = [
	[/^elites?$/i, 'elite'],
	[/^troops?$/i, 'troop'],
	[/^mercenar(y|ies)$/i, 'mercenary'],
	[/^special$/i, 'special'],
	[/^(dead|fallen)$/i, 'dead'],
	[/^(stash|arsenal|strongbox)$/i, 'stash'],
	[/^fire\s*teams?$/i, 'fireteams'],
	[/^locations?$/i, 'locations'],
	[/^(exploration|notes|campaign)$/i, 'other']
];
const BULLET = /^\s*(?:[•·▪◦*\-–]|\.{2,})\s+/;
/** A line without the export's decoration: headline marks, Discord bold, bullets. */
const bare = (line: string) =>
	line
		.replace(/\*\*|__/g, '')
		.replace(/^\s*#+\s*|\s*#+\s*$/g, '')
		.replace(BULLET, '')
		.trim();
/** "123 Ducats | 3 Glory", "123 D | 3 G": each currency's amount. */
function costs(s: string): Price {
	const out = { ducats: 0, glory: 0 };
	for (const m of s.matchAll(/(\d+)\s*(ducats?|d\b|glory|g\b)/gi))
		out[/^g/i.test(m[2]!) ? 'glory' : 'ducats'] += Number(m[1]);
	return out;
}
const list = (s: string) =>
	s
		.split(/,(?![^(]*\))/)
		.map((x) => x.trim())
		.filter(Boolean);

/** Read the text export into names (see match.ts for the ids). */
export function parseText(text: string): Named {
	const named: Named = {
		ducats: 0,
		glory: 0,
		fighters: [],
		stash: [],
		fireteams: [],
		locations: []
	};
	const teams: string[][] = [];
	let section: Section | null = null;
	let cur: NamedFighter | null = null;
	for (const raw of text.split(/\r?\n/)) {
		const line = bare(raw);
		if (!line || /^-{3,}/.test(line) || /^view online/i.test(line) || /^https?:\/\//.test(line))
			continue;
		const sec = SECTIONS.find(([re]) => re.test(line.replace(/:$/, '')));
		if (sec) {
			section = sec[1];
			cur = null;
			continue;
		}
		const label = /^([A-Za-z &]+):\s*(.*)$/.exec(line);
		const [key, value] = label ? [label[1]!, label[2]!] : ['', ''];
		const bullet = BULLET.test(raw);
		if (!section) {
			if (/^faction$/i.test(key)) named.faction = value.trim();
			else if (/^patron$/i.test(key)) named.patron = value.trim();
			else if (/^rating$/i.test(key)) {
				const d = /(\d+)\s*Ducats/i.exec(value);
				if (d) named.rating = Number(d[1]);
			} else if (!label && !named.name) named.name = line;
		} else if (section === 'stash') {
			if (/ducats/i.test(key)) named.ducats = Number(value.match(/-?\d+/)?.[0] ?? 0);
			else if (/glory/i.test(key)) named.glory = Number(value.match(/-?\d+/)?.[0] ?? 0);
			else named.stash.push(...list(label ? value : line));
		} else if (section === 'fireteams') {
			if (!bullet) teams.push([]);
			else teams.at(-1)?.push(line);
		} else if (section === 'locations') {
			if (!bullet) named.locations.push({ name: line });
			else {
				const l = named.locations.at(-1);
				if (l) l.note = l.note ? `${l.note}\n${line}` : line;
			}
		} else if (section !== 'other') {
			if (label && cur) {
				if (/cost/i.test(key)) cur.paid = costs(value);
				else if (/battlekit|equipment|kit/i.test(key)) cur.kit = list(value);
				else if (/upgrade|choice/i.test(key)) cur.upgrades = list(value);
				else if (/skill|advance/i.test(key)) cur.skills = list(value);
				else if (/injur|scar/i.test(key)) cur.injuries = list(value);
				else if (/xp|experience/i.test(key)) cur.xp = Number(value.match(/\d+/)?.[0] ?? 0);
				else if (/status/i.test(key) && /dead/i.test(value)) cur.group = 'dead';
				continue;
			}
			// "Unit - Name", "Name (Unit)", or a compact "Unit - 70 D" with the cost on the title line.
			const inline = /^(.*?)\s*[-–—|]\s*(\d+\s*(?:ducats?|d|glory|g)\b.*)$/i.exec(line);
			const title = inline ? inline[1]! : line;
			const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
			const paren = /^(.+?)\s*\((.+)\)$/.exec(title);
			const [unit, name] = dash
				? [dash[1]!, dash[2]!]
				: paren
					? [paren[2]!, paren[1]!]
					: [title, undefined];
			cur = { unit, name, group: section, kit: [], upgrades: [], skills: [], injuries: [], xp: 0 };
			if (inline) cur.paid = costs(inline[2]!);
			named.fighters.push(cur);
		}
	}
	// Fireteam members are named by label: take each fighter once, in list order.
	const used = new Set<number>();
	const labels = named.fighters.map((x) => [
		x.unit,
		x.name ? `${x.unit} - ${x.name}` : x.unit,
		x.name ?? ''
	]);
	for (const t of teams) {
		const ids = t.flatMap((m) => {
			const i = labels.findIndex(
				(l, k) => !used.has(k) && l.some((s) => s.toLowerCase() === m.toLowerCase())
			);
			if (i < 0) return [];
			used.add(i);
			return [i];
		});
		if (ids.length >= 2) named.fireteams.push([ids[0]!, ids[1]!]);
	}
	return named;
}

/** Read a Trench Companion text export into a warband of this rules set; what does not match is reported. */
export const fromText = (
	text: string,
	set: SetWithBase,
	into?: { factionId: string; variantId?: string }
) => matchNamed(parseText(text), set, into);
