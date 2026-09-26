import type { CampaignState } from './engine';

/**
 * The player who has been Aggressor fewer times is the Aggressor; tie (or first
 * game) → null, meaning roll off. Uses completed games only.
 */
export function suggestAggressor(cs: CampaignState, a: string, b: string): string | null {
	const na = cs.players.get(a)?.aggression.length ?? 0;
	const nb = cs.players.get(b)?.aggression.length ?? 0;
	if (na === nb) return null;
	return na < nb ? a : b;
}

export interface ZoneOption {
	zone: string;
	legal: boolean;
	reason?: string;
}

/**
 * Zones the Aggressor may choose: linked to their Entry Zone, already Scouted, or
 * linked to a Scouted zone (Personnel Carrier extends "linked" to 2 hops).
 * Altar of Leviathan: only as both players' final game, and both hold an Omen.
 */
export function zoneOptions(cs: CampaignState, aggressor: string, defender: string): ZoneOption[] {
	const p = cs.players.get(aggressor);
	const d = cs.players.get(defender);
	if (!p || !d) return [];

	const dist = new Map<string, number>();
	const queue: string[] = [];
	for (const z of [p.entryZone, ...p.scouted]) {
		if (!dist.has(z)) {
			dist.set(z, 0);
			queue.push(z);
		}
	}
	while (queue.length) {
		const z = queue.shift()!;
		const dz = dist.get(z)!;
		if (dz >= p.reach) continue;
		for (const n of cs.graph.adj.get(z) ?? []) {
			if (!dist.has(n)) {
				dist.set(n, dz + 1);
				queue.push(n);
			}
		}
	}

	const finalGame = cs.config.gamesPerPlayer - 1;
	const options: ZoneOption[] = [];
	for (const zone of cs.graph.zones.values()) {
		if (zone.type === 'entry') continue;
		if (!dist.has(zone.id)) {
			options.push({ zone: zone.id, legal: false, reason: 'Out of reach' });
			continue;
		}
		if (zone.id === 'altar-of-leviathan') {
			if (p.games !== finalGame || d.games !== finalGame) {
				options.push({ zone: zone.id, legal: false, reason: "Only as both players' final game" });
				continue;
			}
			if (p.omens < 1 || d.omens < 1) {
				options.push({ zone: zone.id, legal: false, reason: 'Both players need an Omen of Leviathan' });
				continue;
			}
		}
		options.push({ zone: zone.id, legal: true });
	}
	return options;
}
