import { env } from '$env/dynamic/private';
import { Redis } from 'ioredis';
import { memoryKv, redisKv, type Kv } from './kv';

/**
 * Redis, when REDIS_URL is set: one connection for commands, one for subscriptions. Without it every user of
 * this module falls back to memory, which is right for a single app instance (dev, tests).
 */
let client: Redis | null | undefined;
let subscriber: Redis | null | undefined;
let store: Kv | undefined;

/** This process, for telling our own bus messages and locks from other instances'. */
export const INSTANCE = crypto.randomUUID();

function connect(name: string) {
	const r = new Redis(env.REDIS_URL!, { connectionName: `carcass-front:${name}`, maxRetriesPerRequest: 3 });
	r.on('error', (e) => console.error(`redis (${name}):`, e.message));
	return r;
}

export function redis(): Redis | null {
	if (client === undefined) client = env.REDIS_URL ? connect('main') : null;
	return client;
}

export function redisSubscriber(): Redis | null {
	if (subscriber === undefined) subscriber = env.REDIS_URL ? connect('sub') : null;
	return subscriber;
}

/** The shared key-value store: Redis if configured, else this process's memory. */
export function kv(): Kv {
	if (!store) {
		const r = redis();
		store = r ? redisKv(r) : memoryKv();
	}
	return store;
}

process.on('sveltekit:shutdown', () => {
	client?.disconnect();
	subscriber?.disconnect();
});
