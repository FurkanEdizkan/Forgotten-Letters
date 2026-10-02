/**
 * The builder's view of a warband, built the same way on the server (to check each action) and in the
 * page (to grey out options with their reasons as you build).
 */
import { sameEntry,
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
import type { Limit, PriceRule, ScopedLimit } from './warband-limits';
import { effectsOf, type CampaignTable } from './progression';
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
	/** Its Goetic Powers or other powers, as printed. */
	powers?: string | null;
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
	cost: number;
	currency: Currency;
	skills: string[];
	/** Battle Scars and injuries (names on the Trauma Table, or free text). */
	injuries?: string[];
}

/** A Patron's Skills as far as building goes: their prices and limits, for models that have the Skill. */
export interface PatronRules {
	name: string;
	skills: { name: string; prices?: PriceRule[]; limits?: Limit[] }[];
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
	patron?: PatronRules | null;
	/** A campaign warband (not a list of one's own). */
	inCampaign?: boolean;
	/** The Campaign Phase's tables, whose rows a model's skills and injuries are (their keywords apply). */
	tables?: CampaignTable[];
}

const same = sameEntry;

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
				: (p.kit?.hire ?? hiredBy([p.description ?? '', p.battlekitNote ?? '', ...p.abilities.map((a) => a.text)].join(' '))),
		recruit: p.kit?.recruit,
		countsAs: p.kit?.countsAs
	};
}

/** Keywords a model has now: its entry's, its upgrades', its Fireteam, and the variant's Leader. */
export function modelKeywords(m: ModelData, profile: ProfileData | null, rules: VariantRules, fireteams: BuilderInput['fireteams'], tables: CampaignTable[] = []) {
	const kw = new Set((profile?.keywords ?? []).map((k) => k.toUpperCase()));
	for (const u of rules.upgrades) if (m.upgrades.includes(u.name)) for (const k of [u.keyword, ...(u.keywords ?? [])]) if (k) kw.add(k);
	if (rules.leader && same(m.type, rules.leader)) kw.add('LEADER');
	if (fireteams.some((f) => f.members.includes(m.id))) kw.add('FIRETEAM');
	if (m.category === 'elite') kw.add('ELITE');
	const fx = effectsOf([...m.skills, ...(m.injuries ?? [])], tables);
	for (const k of fx.keywords) kw.add(k);
	for (const k of fx.removedKeywords) kw.delete(k);
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
			keywords: modelKeywords(m, p, rules, d.fireteams, d.tables),
			status: m.status,
			equipment: m.equipment,
			upgrades: m.upgrades,
			kit: unitKit(p?.battlekitNote, p?.kit),
			cost: m.cost,
			currency: m.currency,
			skills: m.skills,
			injuries: m.injuries ?? [],
			countsAs: p?.kit?.countsAs
		};
	});
	// Every limit with the models it is about: the warband's, each entry's, each item's carriers', each upgrade's
	// holders', and each Patron Skill's.
	const scoped = (ls: Limit[] | undefined, scope?: ScopedLimit['scope']) => (ls ?? []).map((l) => ({ ...l, scope }));
	const limits: ScopedLimit[] = [
		...scoped(rules.limits),
		...d.profiles.flatMap((p) => scoped(p.kit?.limits, { entries: [p.name] })),
		...d.armoury.flatMap((i) => scoped(i.stipulations?.limits, { holding: { names: [i.name] } })),
		...rules.upgrades.flatMap((u) => scoped(u.limits, { upgrades: [u.name] })),
		...(d.patron?.skills ?? []).flatMap((s) => scoped(s.limits, { skills: [s.name] })),
		// A skill's or an injury's limits (Muscle Damage: no HEAVY kit), on the models that have it.
		...(d.tables ?? []).flatMap((t) => t.rows.flatMap((r) => scoped(r.effects?.limits, { skills: [r.name] })))
	];
	// A Skill's prices hold while a model with it is in the warband, unless they name who buys.
	const prices: PriceRule[] = [...rules.prices, ...(d.patron?.skills ?? []).flatMap((s) => (s.prices ?? []).map((r) => (r.who || r.while ? r : { ...r, while: { skills: [s.name] } })))];
	const state: WarbandState = {
		models,
		stash: d.stash,
		ducats: d.ducats,
		glory: d.glory,
		armoury: d.armoury,
		unrestricted: d.unrestricted,
		openExploration: d.openExploration,
		limits,
		prices,
		upgrades: rules.upgrades,
		patron: d.patron?.name ?? null,
		variant: d.faction.variant,
		inCampaign: d.inCampaign
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
