/** Map tokens: uploaded model renders, with the Blender-rendered outpost sheet as the default. */

export type ModelKind = 'outpost' | 'figure';
export type ModelOwner = 'faction' | 'warband';

export interface ModelRef {
	kind: ModelKind;
	ownerType: ModelOwner;
	ownerId: string;
	token: string;
}

/**
 * Frame of `static/fx/outposts.json` for each faction; the order matches
 * OUTPOST_FACTIONS in `scripts/fx/render_fx.py`. Anything else uses the neutral frame.
 */
const OUTPOST_FRAMES = [
	'new-antioch',
	'trench-pilgrims',
	'iron-sultanate',
	'heretic-legions',
	'black-grail',
	'seven-headed-serpent'
];
const NEUTRAL_FRAME = 6;

export function outpostFrame(faction: string): string {
	const i = OUTPOST_FRAMES.indexOf(faction);
	return `outposts_${String(i < 0 ? NEUTRAL_FRAME : i).padStart(2, '0')}`;
}

/**
 * Which uploaded tokens a warband shows: its own model, else its faction's default.
 * The figure token replaces the portrait only when the warband asks for it.
 */
export function resolveTokens(
	models: ModelRef[],
	w: { id: string; faction: string; displayModel: 'portrait' | 'model' }
): { outpostToken: string | null; figureToken: string | null } {
	const find = (kind: ModelKind) =>
		models.find((m) => m.kind === kind && m.ownerType === 'warband' && m.ownerId === w.id)?.token ??
		models.find((m) => m.kind === kind && m.ownerType === 'faction' && m.ownerId === w.faction)?.token ??
		null;
	return {
		outpostToken: find('outpost'),
		figureToken: w.displayModel === 'model' ? find('figure') : null
	};
}

/** Cheap structural check that a file is an STL (binary or ASCII) before storing it. */
export function looksLikeStl(bytes: Uint8Array): boolean {
	if (bytes.length >= 84) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const triangles = view.getUint32(80, true);
		if (triangles > 0 && bytes.length === 84 + triangles * 50) return true;
	}
	const head = new TextDecoder().decode(bytes.subarray(0, 512)).trimStart();
	return head.startsWith('solid') && /facet\s+normal/.test(new TextDecoder().decode(bytes.subarray(0, 4096)));
}
