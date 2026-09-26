import { desc, eq, and, ne } from 'drizzle-orm';
import { db } from './db';
import { game } from './db/schema';
import { loadCampaignState, type Campaign } from './campaign';
import { suppliedOutposts, trackerCvp } from '$lib/rules/engine';
import { standings } from '$lib/rules/scoring';
import { visionById } from '$lib/rules/visions';
import type { PublicSnapshot } from '$lib/snapshot';
import { activeRegions, getFx } from './fx';

/**
 * The only campaign view that leaves the server for players. Vision cards,
 * progress and evidence stay out until the Campaign Master reveals them.
 */
export function publicSnapshot(c: Campaign): PublicSnapshot {
	const { rows, infos, state } = loadCampaignState(c);
	const reveal = c.visionsRevealed;

	const active = db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, c.id), ne(game.status, 'done')))
		.orderBy(desc(game.createdAt))
		.all();
	const recent = db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, c.id), eq(game.status, 'done')))
		.orderBy(desc(game.committedAt))
		.limit(30)
		.all();

	const playing = new Map<string, string>();
	for (const g of active) {
		playing.set(g.aggressorId, g.zone);
		playing.set(g.defenderId, g.zone);
	}

	return {
		campaign: {
			name: c.name,
			gamesPerPlayer: c.gamesPerPlayer,
			houseZones: c.houseZones,
			visionsRevealed: reveal
		},
		warbands: rows.map(({ warband: w, player: p }) => {
			const s = state.players.get(w.id)!;
			return {
				id: w.id,
				name: w.name,
				player: p.name,
				seat: p.seat,
				portrait: p.portrait,
				symbol: w.symbol,
				faction: w.faction,
				variant: w.variant,
				patron: w.patron,
				entryZone: w.entryZone,
				position: playing.get(w.id) ?? s.lastZone ?? w.entryZone,
				playing: playing.has(w.id),
				games: s.games,
				wins: s.wins,
				cvp: trackerCvp(s),
				cvpBreakdown: s.cvp,
				glory: s.glory,
				tracks: s.tracks,
				conquest: s.conquest,
				aggression: s.aggression,
				other: s.other,
				dice: s.dice,
				rerolls: s.rerolls,
				sets: s.sets,
				rollMod: s.rollMod,
				buildings: s.buildings,
				scouted: s.scouted,
				outposts: s.outposts,
				supplied: suppliedOutposts(state, s).zones,
				omens: s.omens,
				apocrypha: s.apocrypha,
				vision: reveal && w.visionCard ? (visionById(w.visionCard)?.name ?? null) : null
			};
		}),
		active: active.map((g) => ({
			id: g.id,
			zone: g.zone,
			aggressor: g.aggressorId,
			defender: g.defenderId,
			scenario: g.scenario,
			weatherEvent: g.weatherEvent
		})),
		recent: recent.map((g) => ({
			id: g.id,
			zone: g.zone,
			aggressor: g.aggressorId,
			defender: g.defenderId,
			winner: g.winnerId,
			scenario: g.scenario,
			weatherEvent: g.weatherEvent,
			at: (g.committedAt ?? g.createdAt).getTime()
		})),
		standings: standings(state, infos, { revealVisions: reveal, final: reveal }),
		merchantTier: state.merchantTier,
		omensTaken: [...state.omensTaken],
		fx: getFx(c.id),
		regions: activeRegions(c.id),
		updatedAt: Date.now()
	};
}
