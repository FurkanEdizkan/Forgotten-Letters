/**
 * Finding each zone's printed circle on the map image. The book draws every zone as an inked circle (sizes differ:
 * basic zones, entry zones and the large special ones), and the zones' pins are placed by hand, often off centre.
 * For each pin we look nearby for the circle whose outline is the strongest dark ring: darker on the line than just
 * inside and just outside it, all the way round (a robust low percentile, so a name banner crossing it doesn't count).
 */

export interface Gray {
	/** Darkness per pixel (255 − luminance), row-major. */
	dark: Uint8Array;
	width: number;
	height: number;
}
export interface Ring {
	x: number;
	y: number;
	r: number;
	/** How strongly the outline stands out, on the softened half-size image (≈ 20 faint, 35+ clear). */
	score: number;
}

const N = 144;
const COS = Float64Array.from({ length: N }, (_, i) => Math.cos((i / N) * 2 * Math.PI));
const SIN = Float64Array.from({ length: N }, (_, i) => Math.sin((i / N) * 2 * Math.PI));
const counts = new Uint16Array(256);
const RANK = Math.floor(N * 0.35);

/**
 * How dark each circle round (cx, cy) is all the way round, for radii lo..hi: the 35th percentile of its samples
 * (a histogram, darkness being 0-255).
 */
function profile(g: Gray, cx: number, cy: number, lo: number, hi: number, out: Float32Array) {
	for (let r = lo; r <= hi; r++) {
		counts.fill(0);
		for (let i = 0; i < N; i++) {
			const x = Math.min(g.width - 1, Math.max(0, Math.round(cx + r * COS[i])));
			const y = Math.min(g.height - 1, Math.max(0, Math.round(cy + r * SIN[i])));
			counts[g.dark[y * g.width + x]]++;
		}
		let seen = 0;
		let v = 0;
		while ((seen += counts[v]) <= RANK) v++;
		out[r - lo] = v;
	}
}

/** The best circle round each candidate centre: its line against just inside and just outside it. */
function search(g: Gray, px: number, py: number, reach: number, rMin: number, rMax: number, gap: number, step: number): Ring {
	let best: Ring = { x: px, y: py, r: rMin, score: -Infinity };
	const lo = rMin - gap;
	const prof = new Float32Array(rMax + gap - lo + 1);
	for (let dy = -reach; dy <= reach; dy += step)
		for (let dx = -reach; dx <= reach; dx += step) {
			profile(g, px + dx, py + dy, lo, rMax + gap, prof);
			for (let r = rMin; r <= rMax; r++) {
				const s = prof[r - lo] - 0.5 * (prof[r - gap - lo] + prof[r + gap - lo]);
				if (s > best.score) best = { x: px + dx, y: py + dy, r, score: s };
			}
		}
	return best;
}

/**
 * The printed circle around a pin at (px, py) in image pixels. Radii are searched from about 2.5% to 8% of the
 * image's width (60 to 190 px on the book's 2398-px map: the smallest zone is about 70, so the drawings inside a
 * zone, often circular themselves, aren't taken for it). A pin far off its circle gets a second, wider look, and the
 * clearer outline wins. Half the book's resolution is plenty.
 */
export function fitRing(g: Gray, px: number, py: number): Ring {
	const unit = g.width / 2398;
	const gap = Math.max(2, Math.round(5 * unit));
	const rMin = Math.max(8, Math.round(60 * unit));
	const rMax = Math.round(190 * unit);
	const look = (reach: number) => {
		const coarse = search(g, px, py, reach, rMin, rMax, gap, Math.max(1, Math.round(reach / 12)));
		// Then to the pixel round the best of the coarse look.
		const fine = search(g, coarse.x, coarse.y, 2, Math.max(rMin, coarse.r - 3), Math.min(rMax, coarse.r + 3), gap, 1);
		return fine.score > coarse.score ? fine : coarse;
	};
	const near = look(Math.round(36 * unit));
	if (near.score >= 30) return near;
	const wide = look(Math.round(60 * unit));
	return wide.score > near.score ? wide : near;
}

/** Below this the outline is too faint to trust; the zone keeps its pin and a default size. */
export const MIN_SCORE = 15;

/** Darkness from 8-bit grey pixels (one channel, row-major). */
export function darkness(grey: Uint8Array | Buffer, width: number, height: number): Gray {
	const dark = new Uint8Array(width * height);
	for (let i = 0; i < dark.length; i++) dark[i] = 255 - grey[i];
	return { dark, width, height };
}
