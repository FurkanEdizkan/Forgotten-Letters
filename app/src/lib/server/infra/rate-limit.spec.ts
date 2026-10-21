import { describe, expect, it } from 'vitest';
import { slidingWindow } from './rate-limit';

function clock(start = 1_000_000) {
	let t = start;
	return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('slidingWindow', () => {
	it('allows 5 tries a minute, then says how long to wait', () => {
		const c = clock();
		const l = slidingWindow(5, 60_000, c.now);
		for (let i = 0; i < 5; i++) {
			expect(l.take('u:bob')).toBe(0);
			c.advance(1000);
		}
		// First try was 5 s ago, so it leaves the window in 55 s.
		expect(l.take('u:bob')).toBe(55);
	});
	it('lets tries through again once the oldest leaves the window', () => {
		const c = clock();
		const l = slidingWindow(5, 60_000, c.now);
		for (let i = 0; i < 5; i++) l.take('k');
		expect(l.take('k')).toBe(60);
		c.advance(60_000);
		expect(l.take('k')).toBe(0);
	});
	it('rounds the wait up to whole seconds', () => {
		const c = clock();
		const l = slidingWindow(1, 60_000, c.now);
		l.take('k');
		c.advance(59_500);
		expect(l.take('k')).toBe(1);
	});
	it('keeps each key apart', () => {
		const c = clock();
		const l = slidingWindow(2, 60_000, c.now);
		l.take('a');
		l.take('a');
		expect(l.take('a')).toBeGreaterThan(0);
		expect(l.take('b')).toBe(0);
	});
	it('waits when any of several keys is over', () => {
		const c = clock();
		const l = slidingWindow(2, 60_000, c.now);
		l.take('ip:1');
		l.take('ip:1');
		expect(l.take('u:new', 'ip:1')).toBeGreaterThan(0);
	});
	it('clear forgets a key', () => {
		const c = clock();
		const l = slidingWindow(1, 60_000, c.now);
		l.take('k', 'other');
		l.clear('k');
		expect(l.take('k')).toBe(0);
		expect(l.take('other')).toBeGreaterThan(0);
	});
	it('does not count refused tries', () => {
		const c = clock();
		const l = slidingWindow(1, 60_000, c.now);
		l.take('k');
		c.advance(30_000);
		expect(l.take('k')).toBe(30);
		c.advance(30_000);
		expect(l.take('k')).toBe(0);
	});
	it('peek reports the wait without recording a try', () => {
		const c = clock();
		const l = slidingWindow(2, 60_000, c.now);
		expect(l.peek('k')).toBe(0);
		expect(l.peek('k')).toBe(0);
		l.take('k');
		expect(l.peek('k')).toBe(0);
		l.take('k');
		c.advance(10_000);
		expect(l.peek('k', 'other')).toBe(50);
	});
});
