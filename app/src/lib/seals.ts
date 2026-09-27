/**
 * Seals: each faction's logo struck as a medallion in Blender (scripts/fx/render_sigils.py), in two
 * passes the app composites live: a neutral silver medallion, and a light mask. The warband's metal
 * tints the first; its two light colours fill the second, foot to crest. Players can recolour their
 * seal, or strike one from their own symbol (rendered in their browser), without re-rendering here.
 *
 * The faction strips are derived from the logos, so they are gitignored; the build includes whichever
 * exist, and a faction without one falls back to the warband's uploaded symbol.
 */
import { sigilFor } from './sigils';

const strips = import.meta.glob('./assets/sigils/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<
	string,
	string
>;

/** Pixels per frame in a strip; must match FRAME in pack_sigils.py. */
export const SEAL_FRAME = 160;
export const SEAL_FRAMES = 32;
/** Seconds for one rise of the light. */
export const SEAL_PERIOD = 4;

export interface SealSettings {
	/** Metal the relief is struck in (#rrggbb). */
	metal?: string;
	/** Light at the foot and at the crest of the rise (#rrggbb). */
	low?: string;
	high?: string;
	/** A seal struck from the player's own symbol: base and light strips, and the source image. */
	custom?: { base: string; light: string; source: string } | null;
}

/** Everything needed to draw a seal: the two strips and the three colours. */
export interface SealLook {
	base: string;
	light: string;
	metal: string;
	low: string;
	high: string;
	/** Struck from the warband's own symbol rather than its faction's logo. */
	custom?: boolean;
}

/** The metal each faction's seal is struck in by default. */
export const FACTION_METAL: Record<string, string> = {
	'new-antioch': '#d9b25a',
	'trench-pilgrims': '#b07a4a',
	'iron-sultanate': '#d4a73a',
	'heretic-legions': '#8c8580',
	'black-grail': '#8e8f55',
	'seven-headed-serpent': '#d4957a'
};

const byName = new Map(
	Object.entries(strips).map(([path, url]) => [path.split('/').pop()!.replace(/\.webp$/, ''), url])
);

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);

/** The faction's default colours. */
export function factionColours(faction: string | null | undefined) {
	const s = sigilFor(faction);
	return { metal: (faction && FACTION_METAL[faction]) || '#b8b0a0', low: s.low, high: s.high };
}

/** How a warband's seal looks, or null when there is neither a custom seal nor one for its faction. */
export function sealLook(faction: string | null | undefined, settings?: SealSettings | null): SealLook | null {
	const custom = settings?.custom;
	const base = custom?.base ?? (faction ? byName.get(faction) : undefined);
	const light = custom?.light ?? (faction ? byName.get(`${faction}-light`) : undefined);
	if (!base || !light) return null;
	const d = factionColours(faction);
	return {
		base,
		light,
		metal: hex(settings?.metal, d.metal),
		low: hex(settings?.low, d.low),
		high: hex(settings?.high, d.high),
		custom: !!custom
	};
}

/** Keep only well-formed colours; used when a player saves their settings. */
export function cleanColours(raw: Record<string, unknown>) {
	const out: Pick<SealSettings, 'metal' | 'low' | 'high'> = {};
	for (const k of ['metal', 'low', 'high'] as const) if (typeof raw[k] === 'string' && HEX.test(raw[k] as string)) out[k] = (raw[k] as string).toLowerCase();
	return out;
}
