/**
 * Live pub/sub: mutations announce a campaign change, live streams re-send state; one-shot effects go to every
 * viewer; and reloads of in-process registries (custom factions, zones) reach every app instance. Each instance
 * delivers to its own listeners at once, and — with Redis — relays to the other instances over one channel.
 */
import type { FxTrigger } from '$lib/fx/types';
import { INSTANCE, redis, redisSubscriber } from './redis';

type Listener = (campaignId: string) => void;
type TriggerListener = (campaignId: string, trigger: FxTrigger) => void;
export type Reloadable = 'factions' | 'zones';

export type BusMessage = { from: string } & (
	| { t: 'change'; campaignId: string }
	| { t: 'trigger'; campaignId: string; trigger: FxTrigger }
	| { t: 'reload'; what: Reloadable }
);

/** How messages reach the other instances (Redis pub/sub in production; a fake in tests). */
export interface Transport {
	send(message: BusMessage): void;
	listen(fn: (message: BusMessage) => void): void;
}

const CHANNEL = 'cf:bus';

export function createHub(instance: string, transport?: Transport) {
	const listeners = new Set<Listener>();
	const triggerListeners = new Set<TriggerListener>();
	const reloadListeners = new Set<(what: Reloadable) => void>();
	const each = <A extends unknown[]>(set: Set<(...a: A) => void>, ...args: A) => {
		for (const fn of set) {
			try {
				fn(...args);
			} catch (e) {
				console.error('hub listener failed', e);
			}
		}
	};
	const deliver = (m: BusMessage) => {
		if (m.t === 'change') each(listeners, m.campaignId);
		else if (m.t === 'trigger') each(triggerListeners, m.campaignId, m.trigger);
		else each(reloadListeners, m.what);
	};
	// Our own messages were delivered when sent; only other instances' are delivered on arrival.
	transport?.listen((m) => m.from !== instance && deliver(m));
	const send = (m: BusMessage, local = true) => {
		if (local) deliver(m);
		transport?.send(m);
	};
	return {
		subscribe(fn: Listener) {
			listeners.add(fn);
			return () => void listeners.delete(fn);
		},
		publish(campaignId: string) {
			send({ from: instance, t: 'change', campaignId });
		},
		/** One-shot effects (lightning, crows…) sent to every viewer, not stored. */
		subscribeTriggers(fn: TriggerListener) {
			triggerListeners.add(fn);
			return () => void triggerListeners.delete(fn);
		},
		sendTrigger(campaignId: string, trigger: FxTrigger) {
			send({ from: instance, t: 'trigger', campaignId, trigger });
		},
		/** Another instance changed a registry this process keeps in memory: reload it here. */
		onReload(fn: (what: Reloadable) => void) {
			reloadListeners.add(fn);
			return () => void reloadListeners.delete(fn);
		},
		/** Tell the other instances to reload a registry this one has just reloaded. */
		announceReload(what: Reloadable) {
			send({ from: instance, t: 'reload', what }, false);
		}
	};
}

function redisTransport(): Transport | undefined {
	const pub = redis();
	const sub = redisSubscriber();
	if (!pub || !sub) return undefined;
	return {
		send: (m) => void pub.publish(CHANNEL, JSON.stringify(m)).catch((e) => console.error('hub publish:', e.message)),
		listen(fn) {
			void sub.subscribe(CHANNEL).catch((e) => console.error('hub subscribe:', e.message));
			sub.on('message', (channel, raw) => {
				if (channel !== CHANNEL) return;
				try {
					fn(JSON.parse(raw) as BusMessage);
				} catch (e) {
					console.error('hub message:', e);
				}
			});
		}
	};
}

let hub: ReturnType<typeof createHub> | undefined;
const theHub = () => (hub ??= createHub(INSTANCE, redisTransport()));

export const subscribe = (fn: Listener) => theHub().subscribe(fn);
export const publish = (campaignId: string) => theHub().publish(campaignId);
export const subscribeTriggers = (fn: TriggerListener) => theHub().subscribeTriggers(fn);
export const sendTrigger = (campaignId: string, trigger: FxTrigger) => theHub().sendTrigger(campaignId, trigger);
export const onReload = (fn: (what: Reloadable) => void) => theHub().onReload(fn);
export const announceReload = (what: Reloadable) => theHub().announceReload(what);
