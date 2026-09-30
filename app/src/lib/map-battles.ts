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
