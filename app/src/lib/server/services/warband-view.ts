/**
 * What the pages and the API show of a warband: its list card, and the whole warband with each fighter's cost,
 * kit (price and sell value), keywords and where they come from, campaign data (status, Experience marks, Battle
 * Scars, promotion), the Arsenal, the next game's Threshold and field strength, and the problems the engine finds.
 */
import { labeller } from './rules';
import {
	buildModel,
	campaign,
	fighterCosts,
	isActive,
	issues as issuesOf,
	nameOf,
	priceOf,
	rating,
	refName,
	statLine,
	type Price
} from '#lib/warbands';
import { STATS } from '#lib/warbands/progression';
import type { ApiFighter, ApiWarband, ApiWarbandCard } from '#lib/schemas/warbands';
import type { Tx } from '../db';
import * as repo from '../repos/warbands';
import { frameFor } from './card-frames';
import { toFighter, type Loaded } from './warband-state';

const seatOut = (s: repo.SeatOf | null) =>
	s
		? {
				campaignId: s.campaignId,
				campaignName: s.campaignName,
				seatId: s.seatId,
				seatName: s.seatName,
				allowBeyondLimits: s.allowBeyondLimits
			}
		: null;

/** A list card; a warband whose rules are no longer loaded still lists, by its ids. */
export function cardOf(
	w: repo.WarbandRow,
	l: Pick<Loaded, 'f' | 'state' | 'opts'> | null,
	seat: repo.SeatOf | null,
	label: (core: string, expansions: string[]) => ApiWarbandCard['rules']
): ApiWarbandCard {
	const r = l ? rating(l.state, l.f, l.opts) : { ducats: 0, glory: 0 };
	return {
		id: w.id,
		name: w.name,
		rulesSet: w.rulesSet,
		rulesExpansions: w.rulesExpansions,
		rules: label(w.rulesSet, w.rulesExpansions),
		factionId: w.factionId,
		factionName: l?.f.faction.name ?? w.factionId,
		variantName: l?.f.dedication ? null : (l?.f.variant?.name ?? null),
		dedicationName: l?.f.faction.dedications?.find((d) => d.key === w.dedication)?.name ?? null,
		rating: r,
		ducatLimit: w.ducatLimit,
		fighters: l ? l.state.fighters.filter(isActive).length : 0,
		problems: l ? issuesOf(l.state, l.f, l.opts).filter((i) => i.severity === 'error').length : 0,
		gamesPlayed: w.gamesPlayed,
		seat: seatOut(seat)
	};
}

const one = (cost: number, currency: 'ducats' | 'glory'): Price => ({
	ducats: currency === 'ducats' ? cost : 0,
	glory: currency === 'glory' ? cost : 0
});

/** The price of buying one more of a line now, for this fighter (or for the Arsenal): "Copy" pays this. */
function buyPrice(l: Loaded, lineId: string, fighterId?: string): Price {
	const line = l.f.idx.lines.get(lineId);
	if (!line) return { ducats: 0, glory: 0 };
	try {
		const p = priceOf(l.state, l.f, { lineId, fighterId }, l.opts);
		return one(p.cost, p.currency);
	} catch {
		return one(line.cost, line.currency);
	}
}

/** A bought piece as the item menus show it: its value (the refund), half of it (the sale), and a copy's price. */
function piece(l: Loaded, from: string, lineId: string) {
	const value = campaign.pieceValue(l.state, l.f, from, lineId, l.opts);
	return {
		price: value,
		sell: campaign.sellValue(value),
		buy: buyPrice(l, lineId, from === 'arsenal' ? undefined : from)
	};
}

function fighterOut(l: Loaded, r: repo.FighterRow, cost: Price, marks: number[]): ApiFighter {
	const { f } = l;
	const unit = f.idx.units.get(r.unitId);
	const x = l.state.fighters.find((y) => y.id === r.id) ?? toFighter(r);
	const model = unit ? buildModel(l.state, f, { ...x, status: 'active' }) : null;
	const line = model ? statLine(model, f) : null;
	const item = (itemId: string, lineId: string | null, fixed: boolean) => {
		const zero = { ducats: 0, glory: 0 };
		return {
			lineId,
			itemId,
			name: nameOf(f, itemId),
			category: f.idx.items.get(itemId)?.category ?? 'equipment',
			range: f.idx.items.get(itemId)?.range ?? null,
			fixed,
			...(lineId && !fixed ? piece(l, r.id, lineId) : { price: zero, sell: zero, buy: zero })
		};
	};
	const made = r.skills.length;
	return {
		id: r.id,
		unitId: r.unitId,
		unitName: unit?.name ?? r.unitId,
		name: r.name,
		group: r.grp,
		category: unit?.category ?? 'troop',
		status: r.status,
		cost,
		kit: [
			...(unit?.kit.fixed ?? []).map((i) => item(i, null, true)),
			...r.kit.map((id) => item(f.idx.lines.get(id)?.item ?? id, id, false))
		],
		upgrades: r.upgrades.map((u) => ({ id: u, name: nameOf(f, u) })),
		skills: r.skills.map((s) => ({ ref: s, name: refName(f, s) })),
		injuries: r.injuries.map((s) => ({ ref: s, name: refName(f, s) })),
		keywords: model ? campaign.keywordSources(model, f) : [],
		xp: r.xp,
		xpMax: campaign.xpMax(unit),
		advancementsDue: Math.max(0, marks.filter((m) => r.xp >= m).length - made),
		scars: r.battleScars,
		promotion: campaign.promotion(l.state, f, x),
		image: r.image ? `/uploads/fighters/${r.id}?v=${r.version}` : null,
		stats: {
			movement: line?.movement.value ?? unit?.stats.movement ?? null,
			ranged: line?.ranged.value ?? unit?.stats.ranged ?? null,
			melee: line?.melee.value ?? unit?.stats.melee ?? null,
			armour: line?.armour.value ?? unit?.stats.armour ?? null,
			base: unit?.stats.base ?? null
		},
		statChanges: line
			? STATS.filter((k) => line[k].from.length).map((k) => ({
					stat: k,
					printed: line[k].printed,
					delta: line[k].delta,
					from: line[k].from
				}))
			: [],
		version: r.version
	};
}

/** The whole warband as the builder and the API show it: costs, rating, problems, seat, campaign data. */
export async function viewOf(tx: Tx, l: Loaded): Promise<ApiWarband> {
	const costs = fighterCosts(l.state, l.f, l.opts);
	// Fighters off the roster are off the rating; their own cost is still shown.
	const costOf = (r: repo.FighterRow) =>
		costs.get(r.id) ??
		fighterCosts(
			{ ...l.state, fighters: [{ ...toFighter(r), group: 'troop', status: 'active' }] },
			l.f,
			l.opts
		).get(r.id) ?? { ducats: 0, glory: 0 };
	const marks = campaign.advancementMarks(l.f);
	const card = cardOf(l.w, l, l.seat, await labeller());
	const next = campaign.nextGame(l.f, l.w.gamesPlayed);
	return {
		...card,
		ownerId: l.w.ownerId,
		ownerName: await repo.ownerName(tx, l.w.ownerId),
		variantId: l.w.variantId,
		patronId: l.w.patronId,
		patronName: l.w.patronId ? nameOf(l.f, l.w.patronId) : null,
		dedication: l.w.dedication,
		dedications: (l.f.faction.dedications ?? []).map((d) => ({ key: d.key, name: d.name })),
		stashDucats: l.w.stashDucats,
		unspentGlory: l.w.unspentGlory,
		stash: l.w.stash.map((id) => {
			const line = l.f.idx.lines.get(id);
			const itemId = line?.item ?? id;
			return {
				lineId: id,
				itemId,
				name: nameOf(l.f, itemId),
				category: l.f.idx.items.get(itemId)?.category ?? 'equipment',
				exploration: !!line?.stipulations?.explorationOnly,
				...piece(l, 'arsenal', id)
			};
		}),
		fireteams: l.w.fireteams,
		locations: l.w.locations,
		notes: l.w.notes,
		fighters: l.rows.map((r) => fighterOut(l, r, costOf(r), marks)),
		fireteamsMax: l.f.rules.fireteams ?? 0,
		issues: issuesOf(l.state, l.f, l.opts),
		victoryPoints: l.w.victoryPoints,
		failedPromotions: l.w.failedPromotions,
		ignoreLimits: l.w.ignoreLimits,
		canRefund: campaign.canRefund(l.w.gamesPlayed),
		nextGame: next,
		advancementMarks: marks,
		elites: campaign.elites(l.state, l.f),
		canChangePatron: patronChangeable(l),
		frame: await frameFor(tx, l.f),
		canEdit: l.canEdit,
		version: l.w.version
	};
}

/**
 * Who may change the Patron (review decision R8): the owner until the first game, or with no campaign; once the
 * seated warband has played, only the campaign's masters.
 */
export const patronChangeable = (l: Pick<Loaded, 'w' | 'seat' | 'canEdit'>) =>
	l.canEdit ? !l.seat || l.w.gamesPlayed === 0 : !!l.seat && l.w.gamesPlayed > 0;
