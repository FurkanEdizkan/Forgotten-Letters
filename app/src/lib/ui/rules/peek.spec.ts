/** Where a rules card sits next to its link. */
import { describe, expect, it } from 'vitest';
import { place } from './peek.svelte';

const view = { width: 1366, height: 768 };
const card = { width: 360, height: 300 };
const at = (left: number, top: number) => ({ left, top, bottom: top + 20, width: 80, height: 20 });

describe('place', () => {
	it('goes under its link when there is room', () => {
		expect(place(at(100, 100), card, view)).toEqual({ x: 100, y: 124 });
	});
	it('flips above its link near the bottom edge', () => {
		expect(place(at(100, 700), card, view)).toEqual({ x: 100, y: 396 });
	});
	it('stays inside the window at the right and left edges', () => {
		expect(place(at(1300, 100), card, view).x).toBe(1366 - 8 - 360);
		expect(place(at(-20, 100), card, view).x).toBe(8);
	});
	it('a card taller than the room on either side is kept inside the window', () => {
		expect(place(at(100, 300), { width: 360, height: 700 }, view).y).toBe(60);
	});
});
