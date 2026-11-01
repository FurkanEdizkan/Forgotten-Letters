/**
 * The neighbourhood graph's layout: a d3-force simulation run to rest in one go (no animation, DESIGN.md §8), with
 * the element itself pinned at the centre. d3-force places nodes and breaks ties with its own seeded generator, so
 * the same graph lays out the same on the server and in the browser.
 */
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';

export interface GraphNode {
	id: string;
	depth: number;
}
export interface GraphLink {
	from: string;
	to: string;
}
export interface Placed {
	id: string;
	x: number;
	y: number;
}

type SimNode = { id: string; depth: number; x?: number; y?: number; fx?: number; fy?: number };

/** Positions inside a `width` × `height` box, centred on (width/2, height/2). */
export function layout(
	nodes: GraphNode[],
	links: GraphLink[],
	width: number,
	height: number
): Placed[] {
	const sim: SimNode[] = nodes.map((n) => ({
		id: n.id,
		depth: n.depth,
		...(n.depth === 0 ? { fx: 0, fy: 0 } : {})
	}));
	const ids = new Set(sim.map((n) => n.id));
	const simLinks = links
		.filter((l) => ids.has(l.from) && ids.has(l.to))
		.map((l) => ({ source: l.from, target: l.to }));
	forceSimulation(sim)
		.force(
			'link',
			forceLink<SimNode, { source: string; target: string }>(simLinks)
				.id((n) => n.id)
				.distance(90)
		)
		.force('charge', forceManyBody().strength(-260))
		.force('collide', forceCollide(34))
		.force('x', forceX(0).strength(0.04))
		.force('y', forceY(0).strength(0.06))
		.stop()
		.tick(300);
	// Fit the result into the box, keeping a margin for the labels.
	const pad = 60;
	const span = Math.max(
		1,
		...sim.map((n) => Math.abs(n.x ?? 0) / (width / 2 - pad)),
		...sim.map((n) => Math.abs(n.y ?? 0) / (height / 2 - pad / 2))
	);
	return sim.map((n) => ({
		id: n.id,
		x: Math.round(width / 2 + (n.x ?? 0) / span),
		y: Math.round(height / 2 + (n.y ?? 0) / span)
	}));
}
