import { desc, eq, and, ne } from 'drizzle-orm';
import { db } from './db';
import { campaign as campaignTable, game } from './db/schema';
import { loadCampaignState, type Campaign } from './campaign';
import { suppliedOutposts, trackerCvp } from '$lib/rules/engine';
import { standings } from '$lib/rules/scoring';
import { visionById } from '$lib/rules/visions';
import type { PublicSnapshot } from '$lib/snapshot';
import { activeRegions, getFx } from './fx';
import { activeUnitsByWarband } from './roster';
import type { GameResult } from './campaign';
import { listModels } from './models';
import { artFor, artIndex } from './unit-art';
import { resolveTokens } from '$lib/models';
import { sealLook } from '$lib/seals';
import { outcome } from '$lib/battle-outcome';
import { createSnapshotCache } from './snapshot-cache';
import { kv } from './redis';
import { subscribe } from './hub';
import { roundBoard } from './rounds';

/**
 * The only campaign view that leaves the server for players. Vision cards,
 * progress and evidence stay out until the Campaign Master reveals them.
 */
export async function publicSnapshot(c: Campaign): Promise<PublicSnapshot> {
	const { rows, infos, state } = await loadCampaignState(c);
	const reveal = c.visionsRevealed;

	const active = (await db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, c.id), ne(game.status, 'done')))
		.orderBy(desc(game.createdAt))
		);
	const recent = (await db
		.select()
		.from(game)
		.where(and(eq(game.campaignId, c.id), eq(game.status, 'done')))
		.orderBy(desc(game.committedAt))
		.limit(30)
		);

	const done = await db
		.select({ id: game.id, zone: game.zone, aggressorId: game.aggressorId, defenderId: game.defenderId, winnerId: game.winnerId, result: game.result, committedAt: game.committedAt, createdAt: game.createdAt })
		.from(game)
		.where(and(eq(game.campaignId, c.id), eq(game.status, 'done')))
		.orderBy(game.committedAt);
	const factionOf = new Map(rows.map(({ warband: w }) => [w.id, w.faction]));

	const unitsBy = await activeUnitsByWarband(c.id);
	const models = await listModels(c.id);
	const art = await artIndex(c.id);
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
			visionsRevealed: reveal,
			stage: c.stage
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
				entryZone: w.entryZone ?? '',
				position: playing.get(w.id) ?? s.lastZone ?? w.entryZone ?? '',
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
				displayModel: w.displayModel,
				seal: sealLook(w.faction, w.seal),
				...resolveTokens(models, w),
				omens: s.omens,
				apocrypha: s.apocrypha,
				vision: reveal && w.visionCard ? (visionById(w.visionCard)?.name ?? null) : null,
				treasury: { ducats: w.treasuryDucats, glory: w.treasuryGlory },
				units: (unitsBy.get(w.id) ?? []).map((u) => ({
					id: u.id,
					name: u.name,
					type: u.type,
					category: u.category,
					leader: u.leader,
					cost: u.cost,
					currency: u.currency,
					experience: u.experience,
					equipment: u.equipment,
					upgrades: u.upgrades,
					skills: u.skills,
					injuries: u.injuries,
					stats: u.stats,
					photo: u.photo,
					art: artFor(art, w.faction, u.type),
					status: u.status
				}))
			};
		}),
		active: active.map((g) => {
			const rolls = (g.weatherRolls ?? null) as { aggressor?: [number, number] | null; defender?: [number, number] | null; chooser?: string | null } | null;
			return {
				id: g.id,
				roundId: g.roundId ?? null,
				zone: g.zone,
				aggressor: g.aggressorId,
				defender: g.defenderId,
				scenario: g.scenario,
				weatherEvent: g.weatherEvent,
				status: g.status,
				aggressorReason: ((g.result ?? {}) as Partial<GameResult>).aggressorReason ?? null,
				weatherRolls: rolls ? { aggressor: rolls.aggressor ?? null, defender: rolls.defender ?? null, chooser: rolls.chooser ?? null } : null
			};
		}),
		recent: recent.map((g) => ({
			id: g.id,
			roundId: g.roundId ?? null,
			zone: g.zone,
			aggressor: g.aggressorId,
			defender: g.defenderId,
			winner: g.winnerId,
			scenario: g.scenario,
			weatherEvent: g.weatherEvent,
			status: g.status,
			aggressorReason: null,
			weatherRolls: null,
			at: (g.committedAt ?? g.createdAt).getTime()
		})),
		monuments: done.map((g) => {
			const o = outcome({ ...g, result: g.result as GameResult | null });
			return {
				gameId: g.id,
				zone: g.zone,
				winnerFaction: o.winner ? (factionOf.get(o.winner) ?? null) : null,
				loserFaction: o.loser ? (factionOf.get(o.loser) ?? null) : null,
				tier: o.tier,
				fallen: o.fallen.aggressor + o.fallen.defender,
				at: (g.committedAt ?? g.createdAt).getTime()
			};
		}),
		standings: standings(state, infos, { revealVisions: reveal, final: reveal }),
		merchantTier: state.merchantTier,
		omensTaken: [...state.omensTaken],
		fx: await getFx(c.id),
		regions: await activeRegions(c.id),
		round: await roundBoard(c),
		updatedAt: Date.now()
	};
}

let snapshots: ReturnType<typeof createSnapshotCache<PublicSnapshot>> | undefined;

/**
 * The public snapshot, built once per change and shared by every live screen and every app instance (see
 * snapshot-cache.ts). Any change — here or on another instance, through the hub — marks it stale.
 */
export function cachedPublicSnapshot(c: Campaign): Promise<PublicSnapshot> {
	return snapshotCache().get(c.id);
}

/** Mark a campaign's snapshot stale without telling live screens (for changes that don't publish). */
export async function snapshotStale(campaignId: string) {
	await snapshotCache().changed(campaignId);
}

function snapshotCache() {
	if (!snapshots) {
		const cache = createSnapshotCache<PublicSnapshot>(kv(), async (id) => {
			const [fresh] = await db.select().from(campaignTable).where(eq(campaignTable.id, id));
			if (!fresh) throw new Error(`campaign ${id} is gone`);
			return publicSnapshot(fresh);
		});
		subscribe((id) => void cache.changed(id).catch((e) => console.error('snapshot cache:', e)));
		snapshots = cache;
	}
	return snapshots;
}
