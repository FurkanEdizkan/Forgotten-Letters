/**
 * Warband builder rules on top of the imported rules data: which profile a model is, how many of
 * each entry the warband may still recruit, and where a piece of battlekit is filed.
 */
export interface ProfileRef {
	id: string;
	name: string;
	faction: string;
	availabilityMin: number;
	availabilityMax: number | null;
	keywords: string[];
}

export interface ModelRef {
	id: string;
	type: string;
	name: string;
	profileId: string | null;
	status: string;
}

const letters = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
/** Singular, near enough: "troopers" → "trooper". */
const one = (s: string) => s.replace(/s$/, '');

/** The rules entry for a model: by its stored link, else by its type's name. */
export function profileFor<P extends ProfileRef>(m: ModelRef, profiles: P[]): P | null {
	if (m.profileId) {
		const p = profiles.find((p) => p.id === m.profileId);
		if (p) return p;
	}
	const t = letters(m.type || m.name);
	if (!t) return null;
	// "Grail Thralls / Fly Thralls" is one entry with two names; "Fly Bereaved" is a kind of "Bereaved".
	const names = (p: P) => [letters(p.name), ...p.name.split('/').map(letters)].filter(Boolean);
	return (
		profiles.find((p) => names(p).includes(t)) ??
		profiles.find((p) => names(p).some((n) => n.startsWith(t) || t.startsWith(n))) ??
		profiles.find((p) => names(p).some((n) => n.length > 4 && (one(t).endsWith(one(n)) || one(n).endsWith(one(t))))) ??
		null
	);
}

/** For each profile: how many the warband fields, and how many more it may recruit (null: no limit). */
export function recruitment<P extends ProfileRef>(profiles: P[], models: ModelRef[]) {
	const active = models.filter((m) => m.status === 'active');
	return profiles.map((p) => {
		const fielded = active.filter((m) => profileFor(m, profiles)?.id === p.id).length;
		return { profile: p, fielded, left: p.availabilityMax == null ? null : Math.max(0, p.availabilityMax - fielded) };
	});
}

/** Warnings a builder shows: no Leader, more than one, or an entry over its limit. */
export function builderWarnings<P extends ProfileRef>(profiles: P[], models: ModelRef[]) {
	const out: string[] = [];
	const active = models.filter((m) => m.status === 'active');
	const leaders = active.filter((m) => profileFor(m, profiles)?.keywords.includes('LEADER')).length;
	if (active.length && leaders === 0) out.push('The warband has no Leader.');
	if (leaders > 1) out.push(`The warband has ${leaders} Leaders; it may have only one.`);
	for (const r of recruitment(profiles, models)) {
		if (r.profile.availabilityMax != null && r.fielded > r.profile.availabilityMax)
			out.push(`${r.fielded} ${r.profile.name}: the limit is ${r.profile.availabilityMax}.`);
	}
	return out;
}

export type ArmouryCategory = 'ranged' | 'grenade' | 'melee' | 'armour' | 'shield' | 'equipment' | 'special';

/** The roster keeps four kinds of kit; the armoury has seven categories. */
export const KIND_OF: Record<ArmouryCategory, 'ranged' | 'melee' | 'armour' | 'equipment'> = {
	ranged: 'ranged',
	grenade: 'ranged',
	melee: 'melee',
	armour: 'armour',
	shield: 'armour',
	equipment: 'equipment',
	special: 'equipment'
};

export const ARMOURY_ORDER: [ArmouryCategory, string][] = [
	['ranged', 'Ranged Weapons'],
	['grenade', 'Grenades'],
	['melee', 'Melee Weapons'],
	['armour', 'Armour'],
	['shield', 'Shields'],
	['equipment', 'Equipment'],
	['special', 'Special']
];

/** File a model's item under its armoury category (by name), else by its stored kind. */
export function armouryCategory(item: { name: string; kind: string }, armoury: { name: string; category: ArmouryCategory }[]): ArmouryCategory {
	const hit = armoury.find((a) => letters(a.name) === letters(item.name));
	return hit?.category ?? (item.kind as ArmouryCategory);
}

/** Items a model may take: its faction's armoury, minus those whose single-copy limit is used. */
export function canTake(item: { limit: number | null; name: string }, held: { name: string }[]) {
	if (item.limit == null) return true;
	return held.filter((h) => letters(h.name) === letters(item.name)).length < item.limit;
}
