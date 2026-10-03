import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { player, rulesUnit, unit, warband } from './db/schema';
import { currentCampaign } from './campaign';
import { canEditWarband, type SessionUser } from './auth';
import { addUnit, roster } from './roster';
import { currentVersion } from './versions';
import { allPatrons, campaignTables, factionRulesText, itemsOf, unitsOf } from './rules-data';
import { findPatron } from '$lib/patrons';
import { FACTIONS } from '$lib/rules/factions';
import { builderState, entryOf, modelKeywords, type BuilderInput, type ProfileData } from '$lib/builder-state';
import { KIND_OF } from '$lib/builder';
import type { Item } from '$lib/roster';
import { entryPrice, findItem, letters, readRules, recruitCheck, unitKit, type ArmouryItem } from '$lib/warband-rules';

/**
 * A warband for the builder: a campaign warband (public to view, its player and the CM may edit) or a
 * player's own list (only its owner and the CM may see or edit it).
 */
export async function builderWarband(id: string, user: SessionUser | null, share?: string | null) {
	const [w] = await db.select().from(warband).where(eq(warband.id, id));
	if (!w) error(404, 'No such warband');
	const c = await currentCampaign();
	const isList = !w.campaignId;
	if (!isList && w.campaignId !== c?.id) error(404, 'No such warband');
	// A private list: its owner and the CM, or anyone with its share link (read-only).
	const shared = !!share && !!w.shareToken && share === w.shareToken;
	if (isList && !shared && !(user && (user.role === 'cm' || user.id === w.listOwnerId))) error(404, 'No such warband');
	// A warband not yet pinned to a rules version (just made) is pinned to the current one.
	if (!w.rulesVersion) {
		const v = await currentVersion(w.edition);
		if (v) {
			await db.update(warband).set({ rulesVersion: v.id }).where(eq(warband.id, w.id));
			w.rulesVersion = v.id;
		}
	}
	const p = w.playerId ? ((await db.select().from(player).where(eq(player.id, w.playerId)))[0] ?? null) : null;
	const canEdit = isList ? !!user && (user.role === 'cm' || user.id === w.listOwnerId) : canEditWarband(user, w.id);
	return { w, p, c: c ?? null, isList, canEdit };
}

/** Everything the rules engine needs about a warband, from the imported rules data. */
export async function builderInput(w: typeof warband.$inferSelect): Promise<BuilderInput & { profiles: ProfileData[] }> {
	const faction = FACTIONS.find((f) => f.id === w.faction);
	const [own, mercs, items, mercItems, glory, explore, text, { units, stash }, patrons, campaign] = await Promise.all([
		// Everything from the warband's own edition of the rules.
		unitsOf(w.faction, w.edition),
		unitsOf('mercenaries', w.edition),
		itemsOf(w.faction, w.edition),
		itemsOf('mercenaries', w.edition),
		itemsOf('glory-items', w.edition),
		itemsOf('exploration', w.edition),
		factionRulesText(w.faction, w.variant, w.edition),
		roster(w.id),
		allPatrons(w.edition),
		campaignTables(w.edition)
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
		kit: u.kit,
		powers: u.powers
	}));
	const mercKit = mercItems
		.filter((i) => carriers(i.name).length && !items.some((x) => letters(x.name) === letters(i.name)))
		.map((i) => ({ ...i, stipulations: { ...(i.stipulations ?? {}), only: i.stipulations?.only?.length ? i.stipulations.only : carriers(i.name) } }));
	// Armoury items the variant takes away ("cannot take the Black Grail Shield") leave its armoury.
	const excluded = new Set(readRules(text.faction, text.variant, text.overrides ?? []).excluded.map(letters));
	// Items any warband may get (Glory Items, exploration finds), where their alignment or factions allow this one.
	// One with the name of a faction item stays beside it, named for where it comes from ("Restraining Muzzle (Glory
	// Item)"), so each keeps its own price, limit and stipulations.
	const alignment = faction?.alignment ?? null;
	const shared = [...glory, ...explore]
		.filter(
			(i) =>
				(!i.stipulations?.alignment || i.stipulations.alignment === alignment) &&
				(!i.stipulations?.factions?.length || i.stipulations.factions.includes(w.faction) || i.stipulations.factions.includes(faction?.under ?? '')) &&
				!excluded.has(letters(i.name))
		)
		.map((i) => (items.some((x) => letters(x.name) === letters(i.name)) ? { ...i, name: `${i.name} (${i.faction === 'glory-items' ? 'Glory Item' : 'Exploration'})` } : i))
		// Glory Items are bought only in a campaign, after an Exploration discovery allows it (Rulebook, Glory Items):
		// the Campaign Master opens them with Open Exploration.
		.map((i) => (i.faction === 'glory-items' ? { ...i, stipulations: { ...(i.stipulations ?? {}), explorationOnly: true } } : i));
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
			upgrades: u.upgrades,
			cost: u.cost,
			currency: u.currency,
			skills: u.skills,
			injuries: u.injuries
		})),
		stash: stash.map((s) => ({ name: s.name, cost: s.cost, currency: s.currency })),
		ducats: w.treasuryDucats,
		glory: w.treasuryGlory,
		unrestricted: w.unrestricted,
		openExploration: w.openExploration,
		fireteams: w.fireteams,
		inCampaign: !!w.campaignId,
		patron: findPatron(patrons, w.patron),
		tables: campaign.tables
	};
}

/**
 * Recruit an entry into a warband, paying for it: its fixed kit free, its price as the rules set it now (the first
 * of some entries costs otherwise), tied to its rules entry. The caller has checked the rules (`recruitCheck`).
 */
export async function recruitEntry(w: typeof warband.$inferSelect, profile: ProfileData, name = '') {
	const input = await builderInput(w);
	const { rules, state } = builderState(input);
	const [row] = await db.select().from(rulesUnit).where(and(eq(rulesUnit.edition, w.edition), eq(rulesUnit.id, profile.id)));
	const kit = unitKit(profile.battlekitNote, profile.kit);
	const fixed: Item[] = kit.fixed.map((n) => {
		const a = findItem(input.armoury, n);
		return a ? { name: a.name, kind: KIND_OF[a.category], cost: 0, currency: a.currency } : { name: n, kind: 'equipment', cost: 0, currency: 'ducats' };
	});
	const price = entryPrice(profile, state);
	const keywords = modelKeywords({ id: '', type: profile.name, name: '', category: profile.category, status: 'active', profileId: profile.id, equipment: [], upgrades: [], cost: profile.cost, currency: profile.currency, skills: [] }, profile, rules, []);
	await addUnit(
		w.campaignId,
		w.id,
		{
			name,
			type: profile.name,
			category: profile.category,
			leader: keywords.includes('LEADER'),
			cost: price.cost,
			currency: price.currency,
			experience: 0,
			equipment: fixed,
			upgrades: [],
			skills: [],
			injuries: [],
			stats: row?.stats ?? {},
			notes: null,
			status: 'active'
		},
		// Recruits are always paid for here; the Campaign Master adds one free in Admin → Roster.
		true
	);
	const { units } = await roster(w.id);
	const fresh = [...units].reverse().find((u) => u.type === profile.name && !u.profileId);
	if (fresh) await db.update(unit).set({ profileId: profile.id }).where(eq(unit.id, fresh.id));
	return fresh ?? null;
}

/** Recruit the models the rules require (the Leader they name, then each must-include), as far as the rules allow. */
export async function recruitRequired(w: typeof warband.$inferSelect) {
	const input = await builderInput(w);
	const { rules } = builderState(input);
	// "A Praetor or a Sorcerer": a limit needing one of some entries brings the first of them.
	const oneOf = rules.limits.filter((l) => l.entries?.length && l.min && !l.per && !l.when).map((l) => ({ name: l.entries![0], n: 1 }));
	const want = [...(rules.leader ? [{ name: rules.leader, n: 1 }] : []), ...rules.mustInclude, ...oneOf];
	for (const need of want)
		for (let k = 0; k < need.n; k++) {
			const now = builderState(await builderInput(w));
			const have = now.state.models.filter((m) => m.status === 'active' && letters(m.type) === letters(need.name)).length;
			if (have >= need.n) break;
			const profile = input.profiles.find((p) => letters(p.name) === letters(need.name) && p.category !== 'mercenary');
			if (!profile || !recruitCheck(entryOf(profile), now.state, now.rules, input.faction).ok) break;
			await recruitEntry(w, profile);
		}
}
