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
import type { ArmouryItem } from '$lib/warband-rules';

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
	const [own, mercs, items, text, { units, stash }] = await Promise.all([
		unitsOf(w.faction),
		unitsOf('mercenaries'),
		itemsOf(w.faction),
		factionRulesText(w.faction, w.variant),
		roster(w.id)
	]);
	// The faction's own entries and this variant's; never another variant's.
	const mine = <T extends { variant: string | null }>(xs: T[]) => xs.filter((x) => !x.variant || x.variant === w.variant);
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
	const armoury: ArmouryItem[] = mine(items).map((i) => ({
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
