/** In-process pub/sub: mutations announce a campaign change; live streams re-send state. */
import type { FxTrigger } from '$lib/fx/types';

type Listener = (campaignId: string) => void;
type TriggerListener = (campaignId: string, trigger: FxTrigger) => void;

const listeners = new Set<Listener>();
const triggerListeners = new Set<TriggerListener>();

export function subscribe(fn: Listener) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function publish(campaignId: string) {
	for (const fn of listeners) {
		try {
			fn(campaignId);
		} catch (e) {
			console.error('hub listener failed', e);
		}
	}
}

/** One-shot effects (lightning, crows…) sent to every viewer, not stored. */
export function subscribeTriggers(fn: TriggerListener) {
	triggerListeners.add(fn);
	return () => triggerListeners.delete(fn);
}

export function sendTrigger(campaignId: string, trigger: FxTrigger) {
	for (const fn of triggerListeners) {
		try {
			fn(campaignId, trigger);
		} catch (e) {
			console.error('trigger listener failed', e);
		}
	}
}
