import type { Redis } from 'ioredis';

/**
 * The small shared store behind caching, rate limits and locks. With REDIS_URL it is Redis, shared by every app
 * instance; without it, an in-memory map that behaves the same for a single instance (dev, tests).
 */
export interface Kv {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlMs: number): Promise<void>;
	del(...keys: string[]): Promise<void>;
	/** Add a member to a set, (re)setting the set's time to live. */
	addToSet(key: string, member: string, ttlMs: number): Promise<void>;
	members(key: string): Promise<string[]>;
	/** Count up within a fixed window starting at the first count; the count after this one. */
	incr(key: string, windowMs: number): Promise<number>;
	/** Take or renew a lock for `holder`; false while someone else holds it. */
	lock(key: string, holder: string, ttlMs: number): Promise<boolean>;
}

export function memoryKv(now: () => number = Date.now): Kv {
	const values = new Map<string, { v: string; exp: number }>();
	const sets = new Map<string, { m: Set<string>; exp: number }>();
	const live = <T extends { exp: number }>(map: Map<string, T>, key: string) => {
		const e = map.get(key);
		if (e && e.exp <= now()) {
			map.delete(key);
			return undefined;
		}
		return e;
	};
	// Drop expired entries now and then so the maps don't grow without bound.
	let ops = 0;
	const sweep = () => {
		if (++ops % 500) return;
		const t = now();
		for (const map of [values, sets] as Map<string, { exp: number }>[]) for (const [k, e] of map) if (e.exp <= t) map.delete(k);
	};
	return {
		async get(key) {
			return live(values, key)?.v ?? null;
		},
		async set(key, v, ttlMs) {
			sweep();
			values.set(key, { v, exp: now() + ttlMs });
		},
		async del(...keys) {
			for (const k of keys) {
				values.delete(k);
				sets.delete(k);
			}
		},
		async addToSet(key, member, ttlMs) {
			sweep();
			const e = live(sets, key) ?? { m: new Set<string>(), exp: 0 };
			e.m.add(member);
			e.exp = now() + ttlMs;
			sets.set(key, e);
		},
		async members(key) {
			return [...(live(sets, key)?.m ?? [])];
		},
		// Kept as a string among the plain values, as Redis does, so get() reads a counter too.
		async incr(key, windowMs) {
			sweep();
			const e = live(values, key);
			if (!e) {
				values.set(key, { v: '1', exp: now() + windowMs });
				return 1;
			}
			const n = Number(e.v) + 1;
			e.v = String(n);
			return n;
		},
		async lock(key, holder, ttlMs) {
			const e = live(values, key);
			if (e && e.v !== holder) return false;
			values.set(key, { v: holder, exp: now() + ttlMs });
			return true;
		}
	};
}

/** Take the lock if free, or renew it if it is already ours, in one step. */
const LOCK = `local v = redis.call('GET', KEYS[1])
if v == false or v == ARGV[1] then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end
return 0`;

export function redisKv(r: Redis): Kv {
	return {
		get: (key) => r.get(key),
		async set(key, v, ttlMs) {
			await r.set(key, v, 'PX', ttlMs);
		},
		async del(...keys) {
			if (keys.length) await r.del(...keys);
		},
		async addToSet(key, member, ttlMs) {
			await r.multi().sadd(key, member).pexpire(key, ttlMs).exec();
		},
		members: (key) => r.smembers(key),
		async incr(key, windowMs) {
			// NX: the window starts at the first count and isn't pushed back by later ones.
			const res = await r.multi().incr(key).pexpire(key, windowMs, 'NX').exec();
			return Number(res?.[0]?.[1] ?? 0);
		},
		async lock(key, holder, ttlMs) {
			return (await r.eval(LOCK, 1, key, holder, String(ttlMs))) === 1;
		}
	};
}
