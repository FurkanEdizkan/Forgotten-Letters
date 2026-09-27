import type { PublicSnapshot } from '$lib/snapshot';
import type { FxTrigger } from '$lib/fx/types';

/**
 * Live campaign state: starts from the server-rendered snapshot and follows
 * /api/stream. EventSource reconnects by itself after drops.
 */
export function liveSnapshot(initial: PublicSnapshot) {
	let snapshot = $state(initial);
	let connected = $state(false);
	const triggerListeners = new Set<(t: FxTrigger) => void>();

	$effect(() => {
		const es = new EventSource('/api/stream');
		es.addEventListener('snapshot', (e) => {
			snapshot = JSON.parse((e as MessageEvent).data);
			connected = true;
		});
		es.addEventListener('trigger', (e) => {
			const t = JSON.parse((e as MessageEvent).data) as FxTrigger;
			for (const fn of triggerListeners) fn(t);
		});
		es.onerror = () => (connected = false);
		return () => es.close();
	});

	return {
		get current() {
			return snapshot;
		},
		get connected() {
			return connected;
		},
		/** Listen for one-shot effects (lightning, crows…); returns an unsubscribe. */
		onTrigger(fn: (t: FxTrigger) => void) {
			triggerListeners.add(fn);
			return () => triggerListeners.delete(fn);
		},
		/** Play a one-shot effect on this screen only (replaying a battle's result). */
		play(t: FxTrigger) {
			for (const fn of triggerListeners) fn(t);
		}
	};
}
