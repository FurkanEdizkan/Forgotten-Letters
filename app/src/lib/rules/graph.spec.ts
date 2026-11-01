import { describe, expect, it } from 'vitest';
import { layout } from './graph';

describe('layout', () => {
	const nodes = [
		{ id: 'a', depth: 0 },
		{ id: 'b', depth: 1 },
		{ id: 'c', depth: 1 },
		{ id: 'd', depth: 2 }
	];
	const links = [
		{ from: 'a', to: 'b' },
		{ from: 'a', to: 'c' },
		{ from: 'c', to: 'd' },
		{ from: 'c', to: 'gone' }
	];
	it('pins the element at the centre and keeps every node inside the box', () => {
		const out = layout(nodes, links, 600, 400);
		expect(out[0]).toEqual({ id: 'a', x: 300, y: 200 });
		for (const p of out) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.x).toBeLessThanOrEqual(600);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeLessThanOrEqual(400);
		}
		expect(new Set(out.map((p) => `${p.x},${p.y}`)).size).toBe(4);
	});
	it('lays out the same graph the same way every time (server and browser agree)', () => {
		expect(layout(nodes, links, 600, 400)).toEqual(layout(nodes, links, 600, 400));
	});
});
