import { ARCHETYPE_NAMES } from '$lib/rules/scenario';
import type { Resource, Zone } from '$lib/rules/types';
import { weatherByRoll } from '$lib/rules/weather';
import type { PublicGame } from '$lib/snapshot';

/** The roster as the battle overlay lists it: the leader first, everyone else in the roster's own order. */
export function hudRoster<T extends { leader: boolean }>(units: readonly T[]): T[] {
	return [...units.filter((u) => u.leader), ...units.filter((u) => !u.leader)];
}

export interface BriefInput {
	game: Pick<PublicGame, 'aggressor' | 'defender' | 'scenario' | 'weatherEvent' | 'weatherRolls'>;
	zone: Pick<Zone, 'name' | 'type' | 'resources' | 'scenario' | 'archetype' | 'bonus'> & { id: string };
	warbands: { id: string; player: string; outposts: string[] }[];
	regions: { name: string | null; zones: string[] | null; weatherEvent: number | null }[];
}

export interface BattleBrief {
	battlefield: {
		name: string;
		kind: 'Entry Zone' | 'Special Zone' | 'Zone';
		resources: Resource[];
		bonus: string | null;
		/** Players holding an Outpost on this field. */
		holders: string[];
		/** Regional weather over the field: the zone's own region first, else the map-wide one. */
		weather: { region: string; name: string; effect: string } | null;
	};
	scenario:
		| { state: 'rolled'; archetype: string; deployment: string; victory: string }
		| { state: 'named'; name: string }
		| { state: 'pending'; archetype: string | null };
	/** The battle's Hell on Earth event, or null before it is rolled. */
	hell: { name: string; effect: string; rolls: { player: string; dice: [number, number]; total: number }[]; chooser: string | null } | null;
}

/** A rolled scenario is stored as "Archetype: Deployment / Victory" (see randomScenario). */
const ROLLED = /^(.+?): (.+?) \/ (.+)$/;

/** Everything the battle overlay says about the fight: where, what is being played for, and the sky over it. */
export function battleBrief({ game, zone, warbands, regions }: BriefInput): BattleBrief {
	const player = (id: string | null) => (id ? (warbands.find((w) => w.id === id)?.player ?? null) : null);
	const region =
		regions.find((r) => r.zones?.includes(zone.id) && r.weatherEvent) ?? regions.find((r) => r.zones === null && r.weatherEvent);
	const regionWeather = region?.weatherEvent ? weatherByRoll(region.weatherEvent) : undefined;

	const named = game.scenario ?? zone.scenario ?? null;
	const rolled = named?.match(ROLLED);
	const scenario: BattleBrief['scenario'] = rolled
		? { state: 'rolled', archetype: rolled[1], deployment: rolled[2], victory: rolled[3] }
		: named
			? { state: 'named', name: named }
			: { state: 'pending', archetype: zone.archetype ? ARCHETYPE_NAMES[zone.archetype] : null };

	const event = game.weatherEvent ? weatherByRoll(game.weatherEvent) : undefined;
	const rolls = game.weatherRolls;
	const hell: BattleBrief['hell'] = event
		? {
				name: event.name,
				effect: event.effect,
				rolls: [
					{ id: game.aggressor, dice: rolls?.aggressor ?? null },
					{ id: game.defender, dice: rolls?.defender ?? null }
				].flatMap(({ id, dice }) => (dice ? [{ player: player(id) ?? '?', dice, total: dice[0] + dice[1] }] : [])),
				chooser: player(rolls?.chooser ?? null)
			}
		: null;

	return {
		battlefield: {
			name: zone.name,
			kind: zone.type === 'entry' ? 'Entry Zone' : zone.type === 'special' ? 'Special Zone' : 'Zone',
			resources: zone.resources,
			bonus: zone.bonus ?? null,
			holders: warbands.filter((w) => w.outposts.includes(zone.id)).map((w) => w.player),
			weather: regionWeather ? { region: region?.name ?? 'Regional weather', name: regionWeather.name, effect: regionWeather.effect } : null
		},
		scenario,
		hell
	};
}
