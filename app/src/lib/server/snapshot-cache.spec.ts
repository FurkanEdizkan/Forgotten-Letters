import { describe, expect, it } from 'vitest';
import { memoryKv } from './kv';
import { createSnapshotCache } from './snapshot-cache';

const deferred = <T>() => {
	let resolve!: (v: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
};

describe('snapshot cache', () => {
	it('builds once for many readers, and again after a change', async () => {
		let builds = 0;
		const cache = createSnapshotCache(memoryKv(), async (id) => ({ id, n: ++builds }));
		const [a, b] = await Promise.all([cache.get('c1'), cache.get('c1')]);
		expect([a, b, await cache.get('c1')]).toEqual([{ id: 'c1', n: 1 }, { id: 'c1', n: 1 }, { id: 'c1', n: 1 }]);
		await cache.changed('c1');
		expect(await cache.get('c1')).toEqual({ id: 'c1', n: 2 });
	});
	it('serves another instance from the shared store instead of rebuilding', async () => {
		const shared = memoryKv();
		let builds = 0;
		const build = async (id: string) => ({ id, n: ++builds });
		await createSnapshotCache(shared, build).get('c1');
		expect(await createSnapshotCache(shared, build).get('c1')).toEqual({ id: 'c1', n: 1 });
		expect(builds).toBe(1);
	});
	it('never keeps a build that started before a change', async () => {
		const shared = memoryKv();
		const slow = deferred<{ v: string }>();
		const started = deferred<void>();
		let fresh = false;
		const cache = createSnapshotCache(shared, async () => {
			if (fresh) return { v: 'new' };
			started.resolve();
			return slow.promise;
		});
		const stale = cache.get('c1');
		await started.promise; // the old build is under way…
		fresh = true;
		await cache.changed('c1'); // …when the campaign changes
		slow.resolve({ v: 'old' });
		expect(await stale).toEqual({ v: 'old' });
		expect(await cache.get('c1')).toEqual({ v: 'new' });
		expect(await createSnapshotCache(shared, async () => ({ v: 'rebuilt' })).get('c1')).toEqual({ v: 'new' });
	});
});
