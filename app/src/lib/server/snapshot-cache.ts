import type { Kv } from './kv';

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * A snapshot built once per change and shared: by every reader in this process (a promise memo) and by every
 * instance (the store, i.e. Redis). Each change bumps the campaign's generation and snapshots are stored under
 * it, so a build that began before a change can only ever land under a generation nobody reads any more.
 * `ttlMs` is only a backstop against a missed change message.
 */
export function createSnapshotCache<T>(store: Kv, build: (campaignId: string) => Promise<T>, ttlMs = 30_000) {
	const memo = new Map<string, { gen: string; value: Promise<T>; exp: number }>();
	const genKey = (id: string) => `cf:snapgen:${id}`;
	const snapKey = (id: string, gen: string) => `cf:snap:${id}:${gen}`;

	return {
		async get(campaignId: string): Promise<T> {
			const gen = (await store.get(genKey(campaignId))) ?? '0';
			// Check and fill the memo in one synchronous step, so concurrent readers share one build.
			const m = memo.get(campaignId);
			if (m && m.gen === gen && m.exp > Date.now()) return m.value;
			const value = (async () => {
				const hit = await store.get(snapKey(campaignId, gen));
				if (hit) return JSON.parse(hit) as T;
				const built = await build(campaignId);
				await store.set(snapKey(campaignId, gen), JSON.stringify(built), ttlMs);
				return built;
			})();
			memo.set(campaignId, { gen, value, exp: Date.now() + ttlMs });
			value.catch(() => memo.delete(campaignId));
			return value;
		},
		/** The campaign changed: whatever is cached for it is stale everywhere. */
		async changed(campaignId: string) {
			memo.delete(campaignId);
			await store.incr(genKey(campaignId), WEEK);
		}
	};
}
