/** The roster as the battle overlay lists it: the leader first, everyone else in the roster's own order. */
export function hudRoster<T extends { leader: boolean }>(units: readonly T[]): T[] {
	return [...units.filter((u) => u.leader), ...units.filter((u) => !u.leader)];
}
