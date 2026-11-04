/**
 * A fighter card's content and geometry (step 4 revision 3), kept pure so it is tested without a browser: what the
 * card says (from the warband view, names only, never rules text), where each part sits on the 800×1000 card, and
 * text wrapping and shrinking given a `measure` function (the canvas's measureText in the browser).
 */
import { CARD_HEIGHT, CARD_WIDTH } from '#lib/schemas/card-frames';
import type { ApiFighter, ApiWarband } from '#lib/schemas/warbands';
import { statTone } from '#lib/warbands/progression';

export { CARD_HEIGHT, CARD_WIDTH };

/** The frame band: a frame draws here; the card's inside starts within it. The template shows it. */
export const BAND = 40;
/** The photo window under the frame band, and the text area below it (the template's dashed boxes). */
export const PHOTO = { x: BAND, y: BAND, w: CARD_WIDTH - 2 * BAND, h: 360 } as const;
export const TEXT = {
	x: BAND + 30,
	y: PHOTO.y + PHOTO.h + 16,
	w: CARD_WIDTH - 2 * (BAND + 30),
	bottom: CARD_HEIGHT - BAND - 16
} as const;

export interface CardData {
	name: string;
	initials: string;
	subtitle: string;
	/** `tone` colours a changed value (green better, red worse); `was` is the printed value it changed from. */
	stats: { label: string; value: string; tone: 'better' | 'worse' | null; was: string | null }[];
	rows: { label: string; value: string }[];
	footer: string;
}

export interface CardLabels {
	stats: { movement: string; ranged: string; melee: string; armour: string; base: string };
	experience: string;
	weapons: string;
	kit: string;
	skills: string;
	injuries: string;
	keywords: string;
	status: string;
	statuses: Record<string, string>;
	xp: (n: number, max: number | null) => string;
	app: string;
}

const join = (xs: string[]) => xs.filter(Boolean).join(' · ');

/** Two letters for the empty photo window: the first letters of the first two words. */
export const initialsOf = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join('');

/**
 * What a fighter's card says, like the reference: entry · warband · seat (player), or just (player) when not seated
 * · faction (its variant or Sin when it has one); the profile; then experience, weapons with range, other kit,
 * skills, injuries and keywords, each only when it has something.
 */
export function cardData(w: ApiWarband, x: ApiFighter, t: CardLabels): CardData {
	const name = x.name ?? x.unitName;
	const who = w.seat ? `${w.seat.seatName} (${w.ownerName})` : `(${w.ownerName})`;
	const faction = w.dedicationName ?? w.variantName ?? w.factionName;
	const weapons = x.kit.filter((k) => k.category === 'ranged' || k.category === 'melee');
	const other = x.kit.filter((k) => k.category !== 'ranged' && k.category !== 'melee');
	const rows = [
		{
			label: t.experience,
			value: join([
				t.xp(x.xp, x.xpMax),
				x.status !== 'active' ? `${t.status}: ${t.statuses[x.status] ?? x.status}` : ''
			])
		},
		{
			label: t.weapons,
			value: join(weapons.map((k) => (k.range ? `${k.name} (${k.range})` : k.name)))
		},
		{ label: t.kit, value: join(other.map((k) => k.name)) },
		{ label: t.skills, value: join(x.skills.map((s) => s.name)) },
		{ label: t.injuries, value: join(x.injuries.map((s) => s.name)) },
		{ label: t.keywords, value: join(x.keywords.map((k) => k.name.toUpperCase())) }
	].filter((r) => r.value);
	const s = x.stats;
	return {
		name,
		initials: initialsOf(name),
		subtitle: join([x.unitName, w.name, who, faction]),
		stats: (['movement', 'ranged', 'melee', 'armour', 'base'] as const).map((k) => {
			const c = k === 'base' ? undefined : x.statChanges.find((y) => y.stat === k);
			return {
				label: t.stats[k],
				value: s[k] ?? '—',
				tone: c ? statTone(c.stat, c.delta) : null,
				was: c?.delta ? c.printed : null
			};
		}),
		rows,
		footer: join([w.seat?.campaignName ?? '', t.app])
	};
}

/** Break text into lines no wider than `max`; a single word wider than `max` stays on its own line. */
export function wrap(text: string, max: number, measure: (s: string) => number): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const next = line ? `${line} ${word}` : word;
		if (line && measure(next) > max) {
			lines.push(line);
			line = word;
		} else line = next;
	}
	if (line) lines.push(line);
	return lines;
}

/** At most `n` lines; the last one cut with "…" (shortened until it fits) when there was more. */
export function clamp(
	lines: string[],
	n: number,
	max: number,
	measure: (s: string) => number
): string[] {
	if (lines.length <= n) return lines;
	const out = lines.slice(0, n);
	let last = `${out[n - 1]}…`;
	while (last.length > 1 && measure(last) > max) last = `${last.slice(0, -2).trimEnd()}…`;
	out[n - 1] = last;
	return out;
}

/** The biggest font size from `start` down to `floor` at which `fits(size)` holds; `floor` when none does. */
export function shrink(start: number, floor: number, fits: (size: number) => boolean): number {
	for (let size = start; size > floor; size--) if (fits(size)) return size;
	return floor;
}
