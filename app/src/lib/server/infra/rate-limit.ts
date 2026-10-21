/**
 * A sliding-window limit kept in memory (one app process). The interface is small so it can move to Postgres if
 * the app ever runs as several processes.
 */
export interface Limiter {
	/** Record a try for each key; the seconds to wait when any key is over its limit, else 0. */
	take(...keys: string[]): number;
	/** The seconds to wait if any key is over its limit now, without recording a try. */
	peek(...keys: string[]): number;
	clear(...keys: string[]): void;
}

export function slidingWindow(limit: number, windowMs: number, now = () => Date.now()): Limiter {
	const hits = new Map<string, number[]>();
	const recent = (k: string, t: number) => (hits.get(k) ?? []).filter((x) => t - x < windowMs);
	return {
		take(...keys) {
			const t = now();
			let wait = 0;
			for (const k of keys) {
				const list = recent(k, t);
				if (list.length >= limit)
					wait = Math.max(wait, Math.ceil((list[0]! + windowMs - t) / 1000));
				else list.push(t);
				hits.set(k, list);
			}
			// Keep the map small: drop keys with no recent hits now and then.
			if (hits.size > 10_000)
				for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
			return wait;
		},
		peek(...keys) {
			const t = now();
			let wait = 0;
			for (const k of keys) {
				const list = recent(k, t);
				if (list.length >= limit)
					wait = Math.max(wait, Math.ceil((list[0]! + windowMs - t) / 1000));
			}
			return wait;
		},
		clear(...keys) {
			for (const k of keys) hits.delete(k);
		}
	};
}
