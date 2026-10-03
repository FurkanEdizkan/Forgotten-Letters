import { applyStat, effectsOf, rowNamed } from '$lib/progression';
import { roster } from './roster';
import { allKeywords } from './rules-data';
import { builderInput, builderWarband } from './builder';
import { armourOf, builderState, modelKeywords } from '$lib/builder-state';
import { findItem } from '$lib/warband-rules';
import { keywordKey } from '$lib/keywords';
import { rosterTotals, type RosterUnit } from '$lib/roster';
import type { SessionUser } from './auth';

/** A warband as a game sheet: each fielded model with its profile, weapons (full profiles), kit and abilities. */
export async function warbandSheet(id: string, user: SessionUser | null, share?: string | null) {
	const { w, p } = await builderWarband(id, user, share);
	const input = await builderInput(w);
	const { rules, state } = builderState(input);
	const [{ units, stash }, keywords] = await Promise.all([roster(w.id), allKeywords(w.edition)]);
	const active = units.filter((u) => u.status === 'active');
	const tables = input.tables ?? [];
	const profile0 = (id: string | null) => input.profiles.find((x) => x.id === id) ?? null;
	const models = active.map((u) => {
		// Skills and injuries from the Campaign Phase's tables change the profile.
		const fx = effectsOf([...u.skills, ...u.injuries], tables);
		const base = { ...(profile0(u.profileId)?.stats ?? {}), ...u.stats };
		const profile = input.profiles.find((x) => x.id === u.profileId) ?? null;
		const ms = state.models.find((m) => m.id === u.id);
		const kit = u.equipment.map((e) => {
			const a = findItem(input.armoury, e.name);
			return {
				name: e.name,
				cost: e.cost,
				currency: e.currency,
				category: a?.category ?? e.kind,
				type: a?.type ?? null,
				range: a?.range ?? null,
				keywords: a?.keywords ?? [],
				text: a?.text ?? null
			};
		});
		return {
			id: u.id,
			name: u.name,
			type: u.type,
			category: u.category,
			cost: u.cost,
			currency: u.currency,
			experience: u.experience,
			stats: { ...base, movement: applyStat(base.movement, fx.stats.movement), ranged: applyStat(base.ranged, fx.stats.ranged), melee: applyStat(base.melee, fx.stats.melee) },
			armour: applyStat(armourOf({ armour: u.stats.armour ?? profile?.stats.armour }, u.equipment, input.armoury, ms?.kit.fixed ?? []), fx.stats.armour) ?? '0',
			keywords: modelKeywords(
				{ id: u.id, type: u.type, name: u.name, category: u.category, status: u.status, profileId: u.profileId, equipment: u.equipment, upgrades: u.upgrades, cost: u.cost, currency: u.currency, skills: u.skills, injuries: u.injuries },
				profile,
				rules,
				w.fireteams,
				tables
			),
			powers: profile?.powers ?? null,
			/** Each skill and injury with what it does (its table text), or nothing for free text. */
			campaign: [...u.skills, ...u.injuries].map((n) => ({ name: n, text: rowNamed(tables, n.replace(/\s*\(.*\)\s*$/, ''))?.row.text ?? null })),
			weapons: kit.filter((k) => k.category === 'ranged' || k.category === 'melee' || k.category === 'grenade'),
			other: kit.filter((k) => !(k.category === 'ranged' || k.category === 'melee' || k.category === 'grenade')),
			abilities: profile?.abilities ?? [],
			injuries: u.injuries,
			skills: u.skills,
			upgrades: u.upgrades,
			fireteams: w.fireteams.filter((t) => t.members.includes(u.id)).map((t) => t.name)
		};
	});
	const totals = rosterTotals(active as unknown as RosterUnit[], stash);
	return {
		warband: {
			id: w.id,
			name: w.name,
			faction: input.faction.name,
			variant: w.variant,
			player: p?.name ?? null,
			ducats: w.treasuryDucats,
			glory: w.treasuryGlory,
			rating: totals,
			stash: stash.map((s) => s.name)
		},
		rules: rules.paragraphs,
		models,
		glossary: Object.fromEntries(keywords.map((k) => [keywordKey(k.name), k.text])),
		looks: Object.fromEntries(keywords.filter((k) => k.look).map((k) => [keywordKey(k.name), k.look]))
	};
}
