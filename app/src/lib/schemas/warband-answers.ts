/**
 * What the warband endpoints and pages answer: a warband (its fighters, kit with prices and sell values, keywords
 * with their sources, campaign data, the Arsenal), list cards, and the dialogs' choices. Shared by the pages, the
 * API and the OpenAPI document.
 */
import { z } from 'zod';
import { GROUPS, STATUSES } from '../warbands/types';

const price = z.object({ ducats: z.number().int(), glory: z.number().int() }).meta({ id: 'Price' });
const named = z.object({ id: z.string(), name: z.string() });

/** A keyword a fighter has, and where it comes from when it is not printed on its entry (shown dashed). */
export const keywordOut = z
	.object({
		kw: z.string(),
		value: z.union([z.string(), z.number()]).optional(),
		name: z.string(),
		derived: z.boolean(),
		from: z.string().optional()
	})
	.meta({ id: 'FighterKeyword' });

export const issueOut = z
	.object({
		code: z.string(),
		text: z.string(),
		fighterId: z.string().optional(),
		severity: z.enum(['error', 'warning'])
	})
	.meta({ id: 'WarbandIssue' });

export const seatRef = z
	.object({
		campaignId: z.uuid(),
		campaignName: z.string(),
		seatId: z.uuid(),
		allowBeyondLimits: z.boolean()
	})
	.meta({ id: 'WarbandSeat' });

export const fighterOut = z
	.object({
		id: z.uuid(),
		unitId: z.string(),
		unitName: z.string(),
		name: z.string().nullable(),
		group: z.enum(GROUPS),
		/** The entry's own category (a Promoted Troop is in the Elites group). */
		category: z.string(),
		status: z.enum(STATUSES),
		cost: price,
		kit: z.array(
			z.object({
				lineId: z.string().nullable(),
				itemId: z.string(),
				name: z.string(),
				category: z.string(),
				fixed: z.boolean(),
				/** What it is worth to the warband now (a refund gives this back); `sell` is half, rounded up. */
				price,
				sell: price,
				/** What one more costs now ("Copy"). */
				buy: price
			})
		),
		upgrades: z.array(named),
		skills: z.array(z.object({ ref: z.string(), name: z.string() })),
		injuries: z.array(z.object({ ref: z.string(), name: z.string() })),
		keywords: z.array(keywordOut),
		xp: z.number().int(),
		/** Limited Potential's cap, or null. */
		xpMax: z.number().int().nullable(),
		/** Advancement Rolls its Experience has earned beyond the skills it has. */
		advancementsDue: z.number().int(),
		scars: z.number().int(),
		/** Why it cannot be Promoted now, or null if it can. */
		promotion: z.string().nullable(),
		/** The image's address, or null for the empty slot. */
		image: z.string().nullable(),
		version: z.number().int()
	})
	.meta({ id: 'Fighter' });

export const warbandCard = z
	.object({
		id: z.uuid(),
		name: z.string(),
		rulesSet: z.string(),
		rulesExpansions: z.array(z.string()),
		factionId: z.string(),
		factionName: z.string(),
		variantName: z.string().nullable(),
		/** The chosen dedication's name (the Court's Sin). */
		dedicationName: z.string().nullable(),
		rating: price,
		ducatLimit: z.number().int(),
		fighters: z.number().int(),
		problems: z.number().int(),
		gamesPlayed: z.number().int(),
		seat: seatRef.nullable()
	})
	.meta({ id: 'WarbandCard' });

export const warbandOut = z
	.object({
		...warbandCard.shape,
		ownerId: z.uuid(),
		ownerName: z.string(),
		variantId: z.string().nullable(),
		patronId: z.string().nullable(),
		patronName: z.string().nullable(),
		dedication: z.string().nullable(),
		dedications: z.array(z.object({ key: z.string(), name: z.string() })),
		stashDucats: z.number().int(),
		unspentGlory: z.number().int(),
		/** The Arsenal: kit held by the warband, not by a fighter. */
		stash: z.array(
			z.object({
				lineId: z.string(),
				itemId: z.string(),
				name: z.string(),
				category: z.string(),
				exploration: z.boolean(),
				price,
				sell: price,
				buy: price
			})
		),
		fireteams: z.array(z.tuple([z.string(), z.string()])),
		locations: z.array(z.object({ name: z.string(), note: z.string().optional() })),
		notes: z.string(),
		fighters: z.array(fighterOut),
		/** How many fireteams the faction may form. */
		fireteamsMax: z.number().int(),
		issues: z.array(issueOut),
		victoryPoints: z.number().int(),
		failedPromotions: z.number().int(),
		ignoreLimits: z.boolean(),
		/** A full refund is still allowed (no game played yet). */
		canRefund: z.boolean(),
		/** Threshold and field strength for the next game, from the rules' Threshold table. */
		nextGame: z
			.object({
				game: z.number().int(),
				threshold: z.number().int(),
				fieldStrength: z.number().int()
			})
			.nullable(),
		advancementMarks: z.array(z.number().int()),
		elites: z.number().int(),
		/** The caller may change the Patron now (R8: the owner until the first game, then the CM). */
		canChangePatron: z.boolean(),
		/** The caller owns it; a campaign master sees it read-only. */
		canEdit: z.boolean(),
		version: z.number().int()
	})
	.meta({ id: 'Warband' });

export const warbandList = z.object({ items: z.array(warbandCard) });
export const importOut = z.object({
	warband: warbandOut,
	unmatched: z.array(z.string()),
	ambiguous: z.array(z.string())
});

const reasons = z.array(z.string());
export const recruitsOut = z.object({
	items: z.array(
		z.object({
			unitId: z.string(),
			name: z.string(),
			category: z.string(),
			cost: z.number().int(),
			currency: z.enum(['ducats', 'glory']),
			/** How many of this entry the warband has, and the most it may have (null: any number). */
			taken: z.number().int(),
			max: z.number().int().nullable(),
			ok: z.boolean(),
			reasons,
			/** Upgrades the entry may take when it is recruited. */
			upgrades: z.array(
				z.object({
					upgradeId: z.string(),
					name: z.string(),
					cost: z.number().int(),
					currency: z.enum(['ducats', 'glory'])
				})
			),
			/** Each way to fill its loadouts, as the armoury lines to buy with it. */
			loadouts: z.array(z.object({ label: z.string(), lines: z.array(z.string()) }))
		})
	)
});
export const armouryOut = z.object({
	items: z.array(
		z.object({
			/** A Battlekit Limit: copies held across the warband and the Arsenal, and the most allowed. */
			used: z.number().int().optional(),
			limit: z.number().int().optional(),
			lineId: z.string(),
			itemId: z.string(),
			name: z.string(),
			category: z.string(),
			price: z.number().int(),
			currency: z.enum(['ducats', 'glory']),
			ok: z.boolean(),
			reasons
		})
	)
});
export const upgradesOut = z.object({
	items: z.array(
		z.object({
			upgradeId: z.string(),
			name: z.string(),
			/** The upgrade's rule text from the rules folder, if it has one. */
			text: z.string().nullable(),
			/** Fighters that have it, and the most that may (null: no warband-wide most). */
			taken: z.number().int(),
			max: z.number().int().nullable(),
			cost: z.number().int(),
			currency: z.enum(['ducats', 'glory']),
			has: z.boolean(),
			ok: z.boolean(),
			reasons
		})
	)
});
export const choicesOut = z.object({
	rules: z.array(z.object({ value: z.string(), label: z.string() })),
	/** The `rules` value the choices below are for. */
	picked: z.string(),
	factions: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			alignment: z.string(),
			startDucats: z.number().int(),
			startGlory: z.number().int(),
			variants: z.array(
				named.extend({ startDucats: z.number().int(), startGlory: z.number().int() })
			),
			/** The faction's dedications (the Court's Sins), one of which is picked with it. */
			dedications: z.array(z.object({ key: z.string(), name: z.string() })),
			/** Patrons by variant id ('' for none). */
			patrons: z.record(z.string(), z.array(named))
		})
	)
});
export const campaignWarbandsOut = z.object({
	items: z.array(z.object({ seatId: z.uuid(), seatName: z.string(), warband: warbandCard }))
});

export type ApiWarband = z.infer<typeof warbandOut>;
export type ApiWarbandCard = z.infer<typeof warbandCard>;
export type ApiFighter = z.infer<typeof fighterOut>;
export type ApiChoices = z.infer<typeof choicesOut>;
export type ApiRecruit = z.infer<typeof recruitsOut>['items'][number];
export type ApiArmouryLine = z.infer<typeof armouryOut>['items'][number];
export type ApiUpgrade = z.infer<typeof upgradesOut>['items'][number];
