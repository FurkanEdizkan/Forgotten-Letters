import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { player, warband } from './db/schema';
import { currentCampaign } from './campaign';
import { canEditWarband, type SessionUser } from './auth';
import { roster } from './roster';
import { factionRulesText, itemsOf, unitsOf } from './rules-data';
import { FACTIONS } from '$lib/rules/factions';
import type { BuilderInput, ProfileData } from '$lib/builder-state';
import { letters, readRules, type ArmouryItem } from '$lib/warband-rules';

/**
 * A warband for the builder: a campaign warband (public to view, its player and the CM may edit) or a
 * player's own list (only its owner and the CM may see or edit it).
 */
export async function builderWarband(id: string, user: SessionUser | null) {
	const [w] = await db.select().from(warband).where(eq(warband.id, id));
	if (!w) error(404, 'No such warband');
	const c = await currentCampaign();
	const isList = !w.campaignId;
	if (!isList && w.campaignId !== c?.id) error(404, 'No such warband');
	if (isList && !(user && (user.role === 'cm' || user.id === w.listOwnerId))) error(404, 'No such warband');
	const p = w.playerId ? ((await db.select().from(player).where(eq(player.id, w.playerId)))[0] ?? null) : null;
	const canEdit = isList ? !!user && (user.role === 'cm' || user.id === w.listOwnerId) : canEditWarband(user, w.id);
	return { w, p, c: c ?? null, isList, canEdit };
}

/** Everything the rules engine needs about a warband, from the imported rules data. */
export async function builderInput(w: typeof warband.$inferSelect): Promise<BuilderInput & { profiles: ProfileData[] }> {
	const faction = FACTIONS.find((f) => f.id === w.faction);
	const [own, mercs, items, mercItems, glory, explore, text, { units, stash }] = await Promise.all([
		unitsOf(w.faction),
		unitsOf('mercenaries'),
		itemsOf(w.faction),
		itemsOf('mercenaries'),
		itemsOf('glory-items'),
		itemsOf('exploration'),
		factionRulesText(w.faction, w.variant),
		roster(w.id)
	]);
	// The faction's own entries and this variant's, never another variant's; a variant's entry replaces the base
	// entry of the same name (it costs more there, or gains a keyword).
	const mine = <T extends { variant: string | null; name: string }>(xs: T[]) => {
		const theirs = xs.filter((x) => w.variant && x.variant === w.variant);
		const replaced = new Set(theirs.map((x) => letters(x.name)));
		return [...xs.filter((x) => !x.variant && !replaced.has(letters(x.name))), ...theirs];
	};
	// Mercenaries' own kit (what they always carry, or may choose at their own price), for them only.
	const carriers = (name: string) =>
		mercs
			.filter((u) => [...(u.kit?.fixed ?? []), ...Object.keys(u.kit?.prices ?? {})].some((f) => letters(f) === letters(name)))
			.map((u) => u.name);
	const profiles: ProfileData[] = [...mine(own), ...mercs].map((u) => ({
		id: u.id,
		name: u.name,
		faction: u.faction,
		variant: u.variant,
		category: u.category,
		availabilityMax: u.availabilityMax,
		cost: u.cost,
		currency: u.currency,
		keywords: u.keywords,
		stats: u.stats,
		battlekitNote: u.battlekitNote,
		description: u.description,
		abilities: u.abilities,
		kit: u.kit
	}));
	const mercKit = mercItems
		.filter((i) => carriers(i.name).length && !items.some((x) => letters(x.name) === letters(i.name)))
		.map((i) => ({ ...i, stipulations: { ...(i.stipulations ?? {}), only: i.stipulations?.only?.length ? i.stipulations.only : carriers(i.name) } }));
	// Armoury items the variant takes away ("cannot take the Black Grail Shield") leave its armoury.
	const excluded = new Set(readRules(text.faction, text.variant, text.overrides ?? []).excluded.map(letters));
	// Items any warband may get (Glory Items, exploration finds), where their alignment or factions allow this one;
	// the faction's own row wins over one of the same name.
	const alignment = faction?.alignment ?? null;
	const shared = [...glory, ...explore].filter(
		(i) =>
			(!i.stipulations?.alignment || i.stipulations.alignment === alignment) &&
			(!i.stipulations?.factions?.length || i.stipulations.factions.includes(w.faction) || i.stipulations.factions.includes(faction?.under ?? '')) &&
			!items.some((x) => letters(x.name) === letters(i.name)) &&
			!excluded.has(letters(i.name))
	);
	const armoury: ArmouryItem[] = [...mine(items).filter((i) => !excluded.has(letters(i.name))), ...mercKit, ...shared].map((i) => ({
		id: i.id,
		name: i.name,
		category: i.category,
		cost: i.cost,
		currency: i.currency,
		limit: i.limit,
		restrictions: i.restrictions,
		type: i.type,
		range: i.range,
		keywords: i.keywords,
		variant: i.variant,
		text: i.text,
		stipulations: i.stipulations
	}));
	return {
		faction: { name: faction?.name ?? w.faction, alignment: faction?.alignment ?? 'faithful', variant: w.variant },
		rulesText: text,
		profiles,
		armoury,
		models: units.map((u) => ({
			id: u.id,
			type: u.type,
			name: u.name,
			category: u.category,
			status: u.status,
			profileId: u.profileId,
			equipment: u.equipment,
			upgrades: u.upgrades
		})),
		stash: stash.map((s) => ({ name: s.name, cost: s.cost, currency: s.currency })),
		ducats: w.treasuryDucats,
		glory: w.treasuryGlory,
		unrestricted: w.unrestricted,
		openExploration: w.openExploration,
		fireteams: w.fireteams
	};
}
