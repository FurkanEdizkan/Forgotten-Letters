/** Where battles stand on the map: several on one zone fan out round it, so each can be seen and picked. */

type Point = { x: number; y: number };

/** Spots for n battles round a zone, the first straight above, clockwise; a lone battle stays on the zone. */
export function battleSpots(center: Point, n: number, radius = 110): Point[] {
	if (n <= 1) return [center];
	return Array.from({ length: n }, (_, i) => {
		const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
		return { x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) };
	});
}

/** Every battle's spot, by id; zones are shared out in the order the battles come. */
export function battlePlacement(
	games: { id: string; zone: string }[],
	centreOf: (zone: string) => Point | null,
	radius: number | ((zone: string) => number) = 110
) {
	const byZone = new Map<string, string[]>();
	for (const g of games) byZone.set(g.zone, [...(byZone.get(g.zone) ?? []), g.id]);
	const at = new Map<string, Point>();
	for (const [zone, ids] of byZone) {
		const c = centreOf(zone);
		if (!c) continue;
		battleSpots(c, ids.length, typeof radius === 'number' ? radius : radius(zone)).forEach((p, i) => at.set(ids[i], p));
	}
	return at;
}

/**
 * Where a zone's warband markers stand: on the zone's own printed circle (radius `R`), in its lower half, starting
 * at the shoulders either side of the name banner (which the book prints across the bottom of the circle) and
 * climbing the sides, right then left, as more arrive. A full circle continues on a second one just outside it.
 * `m` is a marker's radius; markers sit edge to edge with a hair of room. Points are relative to the zone's centre,
 * y down (the bottom of the circle is +y).
 */
export function ringSpots(n: number, R: number, m: number, { banner = (50 * Math.PI) / 180 } = {}): Point[] {
	const out: Point[] = [];
	let radius = R;
	let j = 0;
	while (out.length < n) {
		const step = (2.1 * m) / radius;
		const off = banner + j * step;
		if (off > Math.PI + 1e-9) {
			// This circle is full up to its top: on to the next one out.
			radius += 2.2 * m;
			j = 0;
			continue;
		}
		for (const side of [1, -1]) {
			if (out.length >= n) break;
			const a = Math.PI / 2 - side * off; // from the bottom (+y), right (side 1) or left (−1)
			if (side === -1 && j > 0 && Math.abs(off - Math.PI) < 1e-9) break; // the top: one marker, not two
			out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
		}
		j++;
	}
	return out;
}

/**
 * Where a battle's two warbands stand: on the battle's ring (radius `ringR`), the Aggressor at its left and the
 * Defender at its right, facing each other across the field. Relative to the ring's centre.
 */
export function battleFlanks(ringR: number): [Point, Point] {
	return [
		{ x: -ringR, y: 0 },
		{ x: ringR, y: 0 }
	];
}
