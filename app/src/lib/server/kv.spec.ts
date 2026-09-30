import { describe, expect, it } from 'vitest';
import { memoryKv, type Kv } from './kv';

/** The contract every Kv (memory or Redis) keeps; run against memory here with a clock we control. */
function contract(make: (now: () => number) => Kv) {
	it('stores with a time to live, then forgets', async () => {
		let t = 0;
		const kv = make(() => t);
		await kv.set('a', 'one', 1000);
		expect(await kv.get('a')).toBe('one');
		t = 1001;
		expect(await kv.get('a')).toBe(null);
	});
	it('deletes, and keeps members of a set until it expires', async () => {
		let t = 0;
		const kv = make(() => t);
		await kv.set('a', '1', 1000);
		await kv.del('a', 'missing');
		expect(await kv.get('a')).toBe(null);
		await kv.addToSet('s', 'x', 1000);
		await kv.addToSet('s', 'y', 1000);
		expect((await kv.members('s')).sort()).toEqual(['x', 'y']);
		t = 2000;
		expect(await kv.members('s')).toEqual([]);
	});
	it('counts within a window, and starts again after it', async () => {
		let t = 0;
		const kv = make(() => t);
		expect([await kv.incr('n', 1000), await kv.incr('n', 1000), await kv.incr('n', 1000)]).toEqual([1, 2, 3]);
		expect(await kv.get('n')).toBe('3');
		t = 1001;
		expect(await kv.incr('n', 1000)).toBe(1);
	});
	it('gives a lock to one holder at a time, lets the holder renew it, and frees it on expiry', async () => {
		let t = 0;
		const kv = make(() => t);
		expect(await kv.lock('lead', 'a', 1000)).toBe(true);
		expect(await kv.lock('lead', 'b', 1000)).toBe(false);
		t = 900;
		expect(await kv.lock('lead', 'a', 1000)).toBe(true);
		t = 1500;
		expect(await kv.lock('lead', 'b', 1000)).toBe(false);
		t = 2000;
		expect(await kv.lock('lead', 'b', 1000)).toBe(true);
	});
}

describe('memoryKv', () => contract((now) => memoryKv(now)));

// Against a real Redis when one is configured (REDIS_URL=redis://127.0.0.1:6380 npm test), in real time.
describe.runIf(!!process.env.REDIS_URL)('redisKv', async () => {
	const { default: Redis } = await import('ioredis');
	const { redisKv } = await import('./kv');
	const r = new Redis(process.env.REDIS_URL!);
	const kv = redisKv(r);
	const k = (s: string) => `cf:test:${process.pid}:${s}`;
	const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

	it('keeps the same contract', async () => {
		await kv.set(k('a'), 'one', 150);
		expect(await kv.get(k('a'))).toBe('one');
		await kv.addToSet(k('s'), 'x', 150);
		expect(await kv.members(k('s'))).toEqual(['x']);
		expect([await kv.incr(k('n'), 150), await kv.incr(k('n'), 150)]).toEqual([1, 2]);
		expect(await kv.get(k('n'))).toBe('2');
		expect(await kv.lock(k('l'), 'a', 150)).toBe(true);
		expect(await kv.lock(k('l'), 'b', 150)).toBe(false);
		expect(await kv.lock(k('l'), 'a', 150)).toBe(true);
		await sleep(220);
		expect(await kv.get(k('a'))).toBe(null);
		expect(await kv.members(k('s'))).toEqual([]);
		expect(await kv.incr(k('n'), 150)).toBe(1);
		expect(await kv.lock(k('l'), 'b', 150)).toBe(true);
		await kv.del(k('n'), k('l'));
		r.disconnect();
	});
});
