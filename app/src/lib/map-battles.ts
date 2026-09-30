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
export function battlePlacement(games: { id: string; zone: string }[], centreOf: (zone: string) => Point | null, radius = 110) {
	const byZone = new Map<string, string[]>();
	for (const g of games) byZone.set(g.zone, [...(byZone.get(g.zone) ?? []), g.id]);
	const at = new Map<string, Point>();
	for (const [zone, ids] of byZone) {
		const c = centreOf(zone);
		if (!c) continue;
		battleSpots(c, ids.length, radius).forEach((p, i) => at.set(ids[i], p));
	}
	return at;
}

/**
 * Where a zone's warband markers stand, in the marker group's own units (the group is scaled by `k` with the zoom):
 * on a ring clear of the zone's tap target, so the zone itself can always be tapped (to arrange a battle there).
 * A lone warband stands up and to the right; several spread round the ring from there.
 */
export function markerSpots(n: number, k: number, { clear, markerR }: { clear: number; markerR: number }): Point[] {
	const r = clear / k + markerR + (n > 1 ? n * 4 : 0);
	return Array.from({ length: n }, (_, i) => {
		const a = -Math.PI / 4 + (i / n) * Math.PI * 2;
		return { x: Math.cos(a) * r, y: Math.sin(a) * r };
	});
}

/**
 * Where a battle's two warbands stand, in their marker group's own units (scaled by `k` with the zoom): on the battle's
 * ring, the Aggressor on its left and the Defender on its right, so the pair reads as fighting there and reaches no
 * further out than it must (neighbouring zones can be close).
 */
export function battleFlanks(ringR: number, k: number): [Point, Point] {
	const x = ringR / k;
	return [
		{ x: -x, y: 0 },
		{ x, y: 0 }
	];
}
