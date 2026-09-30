import { describe, expect, it } from 'vitest';
import { createHub, type BusMessage, type Transport } from './hub';

/** A pretend Redis channel shared by several hubs (instances). */
function channel() {
	const listeners: ((m: BusMessage) => void)[] = [];
	const transport = (): Transport => ({
		send: (m) => listeners.forEach((fn) => fn(JSON.parse(JSON.stringify(m)))),
		listen: (fn) => void listeners.push(fn)
	});
	return transport;
}

describe('hub', () => {
	it('delivers a change to its own subscribers once, and to other instances', () => {
		const ch = channel();
		const a = createHub('a', ch()), b = createHub('b', ch());
		const seen: string[] = [];
		a.subscribe((c) => seen.push(`a:${c}`));
		b.subscribe((c) => seen.push(`b:${c}`));
		a.publish('camp1');
		expect(seen).toEqual(['a:camp1', 'b:camp1']);
	});
	it('carries effect triggers to every instance', () => {
		const ch = channel();
		const a = createHub('a', ch()), b = createHub('b', ch());
		const got: unknown[] = [];
		b.subscribeTriggers((c, t) => got.push([c, t.kind]));
		a.sendTrigger('camp1', { kind: 'dice', seed: 1 } as never);
		expect(got).toEqual([['camp1', 'dice']]);
	});
	it('asks only the other instances to reload what one of them changed', () => {
		const ch = channel();
		const a = createHub('a', ch()), b = createHub('b', ch());
		const reloads: string[] = [];
		a.onReload((what) => reloads.push(`a:${what}`));
		b.onReload((what) => reloads.push(`b:${what}`));
		a.announceReload('zones');
		expect(reloads).toEqual(['b:zones']);
	});
	it('works alone with no transport, and survives a failing listener', () => {
		const hub = createHub('solo');
		const seen: string[] = [];
		hub.subscribe(() => {
			throw new Error('boom');
		});
		hub.subscribe((c) => seen.push(c));
		hub.publish('camp1');
		expect(seen).toEqual(['camp1']);
	});
});
