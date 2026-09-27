/**
 * The builder's view of a warband, built the same way on the server (to check each action) and in the
 * page (to grey out options with their reasons as you build).
 */
import {
	hiredBy,
	letters,
	readRules,
	unitKit,
	type ArmouryItem,
	type EntryRef,
	type HeldItem,
	type ModelState,
	type RulesOverride,
	type UnitKitOverride,
	type VariantRules,
	type WarbandState
} from './warband-rules';
import type { Currency } from './roster';

export interface ProfileData {
	id: string;
	name: string;
	faction: string;
	variant: string | null;
	category: 'elite' | 'troop' | 'mercenary';
	availabilityMax: number | null;
	cost: number;
	currency: Currency;
	keywords: string[];
	stats: { movement?: string; ranged?: string; melee?: string; armour?: string; base?: string };
	battlekitNote: string | null;
	description: string | null;
	abilities: { name: string; text: string }[];
	/** Hand-set builder facts (Faction Studio). */
	kit?: UnitKitOverride | null;
}

export interface ModelData {
	id: string;
	type: string;
	name: string;
	category: 'elite' | 'troop' | 'mercenary';
	status: string;
	profileId: string | null;
	equipment: HeldItem[];
	upgrades: string[];
}

export interface BuilderInput {
	faction: { name: string; alignment: 'faithful' | 'fallen'; variant: string | null };
	rulesText: { faction: string | null; variant: string | null; overrides?: (RulesOverride | null)[] };
	profiles: ProfileData[];
	armoury: ArmouryItem[];
	models: ModelData[];
	stash: HeldItem[];
	ducats: number;
	glory: number;
	unrestricted: boolean;
	openExploration: boolean;
	fireteams: { name: string; members: string[] }[];
}

const same = (a: string, b: string) => {
	const x = letters(a).replace(/s$/, '');
	const y = letters(b).replace(/s$/, '');
	return x === y || x.includes(y) || y.includes(x);
};

export function entryOf(p: ProfileData): EntryRef {
	return {
		name: p.name,
		category: p.category,
		availabilityMax: p.availabilityMax,
		cost: p.cost,
		currency: p.currency,
		keywords: p.keywords,
		hire:
			p.category !== 'mercenary'
				? undefined
				: (p.kit?.hire ?? hiredBy([p.description ?? '', p.battlekitNote ?? '', ...p.abilities.map((a) => a.text)].join(' ')))
	};
}

/** Keywords a model has now: its entry's, its upgrades', its Fireteam, and the variant's Leader. */
export function modelKeywords(m: ModelData, profile: ProfileData | null, rules: VariantRules, fireteams: BuilderInput['fireteams']) {
	const kw = new Set((profile?.keywords ?? []).map((k) => k.toUpperCase()));
	for (const u of rules.upgrades) if (u.keyword && m.upgrades.includes(u.name)) kw.add(u.keyword);
	if (rules.leader && same(m.type, rules.leader)) kw.add('LEADER');
	if (fireteams.some((f) => f.members.includes(m.id))) kw.add('FIRETEAM');
	if (m.category === 'elite') kw.add('ELITE');
	return [...kw];
}

export function builderState(d: BuilderInput) {
	const rules = readRules(d.rulesText.faction, d.rulesText.variant, d.rulesText.overrides ?? []);
	const profileOf = (m: ModelData) => d.profiles.find((p) => p.id === m.profileId) ?? d.profiles.find((p) => same(p.name, m.type)) ?? null;
	const models: ModelState[] = d.models.map((m) => {
		const p = profileOf(m);
		return {
			id: m.id,
			type: p?.name ?? m.type,
			category: m.category,
			keywords: modelKeywords(m, p, rules, d.fireteams),
			status: m.status,
			equipment: m.equipment,
			upgrades: m.upgrades,
			kit: unitKit(p?.battlekitNote, p?.kit)
		};
	});
	const state: WarbandState = {
		models,
		stash: d.stash,
		ducats: d.ducats,
		glory: d.glory,
		armoury: d.armoury,
		unrestricted: d.unrestricted,
		openExploration: d.openExploration
	};
	return { rules, state, profileOf, entries: d.profiles.map(entryOf) };
}

/** The Armour characteristic with the model's armour and shield ("-1 INJURY MODIFIER"); fixed kit is already in the profile. */
export function armourOf(
	stats: { armour?: string },
	equipment: HeldItem[],
	armoury: ArmouryItem[],
	fixed: string[]
): string {
	const base = Number.parseInt(String(stats.armour ?? '0')) || 0;
	const isFixed = new Set(fixed.map(letters));
	let mod = 0;
	for (const e of equipment) {
		const a = armoury.find((x) => letters(x.name) === letters(e.name));
		if (!a || (a.category !== 'armour' && a.category !== 'shield') || isFixed.has(letters(e.name))) continue;
		for (const k of a.keywords) {
			const m = k.match(/([+-]\d+)\s*INJURY MODIFIER/i);
			if (m) mod += Number(m[1]);
		}
	}
	const v = base + mod;
	return v > 0 ? `+${v}` : String(v);
}
