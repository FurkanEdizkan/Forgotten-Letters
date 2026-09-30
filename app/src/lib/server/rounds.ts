import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from './db';
import { campaign, game, round, roundEntry, warband } from './db/schema';
import { loadCampaignState, type Campaign } from './campaign';
import { BattleError, busyWarbands, planGame, serverD6 } from './games';
import { publish, sendTrigger } from './hub';
import { zoneOptions } from '$lib/rules/legality';
import { aggressorCount, byes, eligibleForRound, nextPicker, rankEntries, rollOffNeeded } from '$lib/rules/round';

export class RoundError extends Error {}

export type Round = typeof round.$inferSelect;

/** The round in progress (the latest not closed), if any. */
export async function openRoundOf(c: Campaign): Promise<Round | null> {
	const [r] = await db
		.select()
		.from(round)
		.where(and(eq(round.campaignId, c.id), ne(round.step, 'closed')))
		.orderBy(desc(round.number))
		.limit(1);
	return r ?? null;
}

/**
 * Open the next round with every warband that can still fight. With fewer than two, nothing opens; with none left
 * and no battle still on the field, the campaign has ended.
 */
export async function openRound(c: Campaign): Promise<Round | null> {
	if (c.stage !== 'underway') throw new RoundError('Rounds begin once the campaign is under way');
	if (await openRoundOf(c)) throw new RoundError('A round is already in progress');
	const { state } = await loadCampaignState(c);
	const busy = await busyWarbands(c.id);
	const players = [...state.players.entries()].map(([id, p]) => ({ id, games: p.games, busy: busy.has(id), aggressions: p.aggression.length }));
	const eligible = eligibleForRound(players, c.gamesPerPlayer);
	if (eligible.length < 2) {
		if (!players.some((p) => p.games < c.gamesPerPlayer) && !busy.size) {
			await db.update(campaign).set({ stage: 'ended' }).where(eq(campaign.id, c.id));
			publish(c.id);
		}
		return null;
	}
	const [last] = await db.select({ number: round.number }).from(round).where(eq(round.campaignId, c.id)).orderBy(desc(round.number)).limit(1);
	const [r] = await db.insert(round).values({ campaignId: c.id, number: (last?.number ?? 0) + 1 }).returning();
	await db.insert(roundEntry).values(
		eligible.map((id) => ({ roundId: r.id, warbandId: id, aggressions: players.find((p) => p.id === id)!.aggressions }))
	);
	publish(c.id);
	return r;
}

async function entriesOf(roundId: string) {
	return db.select().from(roundEntry).where(eq(roundEntry.roundId, roundId));
}

/** The warband rolls its D6 for the Aggressor roll-off (first roll, or a re-roll when tied). */
export async function rollForAggressor(c: Campaign, roundId: string, warbandId: string) {
	const [r] = await db.select().from(round).where(and(eq(round.id, roundId), eq(round.campaignId, c.id)));
	if (!r || r.step !== 'rolling') throw new RoundError('The roll-off is over');
	const entries = await entriesOf(r.id);
	const me = entries.find((e) => e.warbandId === warbandId);
	if (!me) throw new RoundError('This warband sits out this round');
	const need = rollOffNeeded(entries.map((e) => ({ id: e.warbandId, aggressions: e.aggressions, rolls: e.rolls })));
	if (!need.waiting.includes(warbandId) && !need.reroll.includes(warbandId)) throw new RoundError('No roll needed from this warband now');
	const die = serverD6();
	await db
		.update(roundEntry)
		.set({ rolls: [...me.rolls, die] })
		.where(and(eq(roundEntry.roundId, r.id), eq(roundEntry.warbandId, warbandId)));
	const [w] = await db.select({ name: warband.name }).from(warband).where(eq(warband.id, warbandId));
	sendTrigger(c.id, {
		kind: 'roll',
		zone: null,
		seed: Date.now(),
		roll: { warbandId, who: w?.name ?? 'A warband', dice: [die], purpose: 'aggressor', label: me.rolls.length ? 'Re-roll for Aggressor' : 'Roll for Aggressor' }
	});
	await settleRollOff(r.id);
	publish(c.id);
	return die;
}

/** Once nobody is waiting and no tie decides anything, assign the roles and the picking order. */
async function settleRollOff(roundId: string) {
	const entries = await entriesOf(roundId);
	const view = entries.map((e) => ({ id: e.warbandId, aggressions: e.aggressions, rolls: e.rolls }));
	const need = rollOffNeeded(view);
	if (need.waiting.length || need.reroll.length) return;
	const ranked = rankEntries(view);
	const cut = aggressorCount(ranked.length);
	for (const [i, e] of ranked.entries())
		await db
			.update(roundEntry)
			.set({ role: i < cut ? 'aggressor' : 'defender', pickOrder: i < cut ? i + 1 : null })
			.where(and(eq(roundEntry.roundId, roundId), eq(roundEntry.warbandId, e.id)));
	await db.update(round).set({ step: 'pairing' }).where(eq(round.id, roundId));
}

/** Where things stand in the pairing: whose turn, who is still free, what is taken. */
async function pairing(roundId: string) {
	const entries = await entriesOf(roundId);
	const games = await db.select().from(game).where(eq(game.roundId, roundId));
	const aggressors = entries.filter((e) => e.role === 'aggressor').sort((a, b) => (a.pickOrder ?? 0) - (b.pickOrder ?? 0)).map((e) => e.warbandId);
	const defenders = entries.filter((e) => e.role === 'defender' || e.role === 'bye').map((e) => e.warbandId);
	const picked = new Set(games.map((g) => g.aggressorId));
	const taken = new Set(games.map((g) => g.defenderId));
	return { entries, games, aggressors, defenders, picker: nextPicker(aggressors, picked), free: defenders.filter((d) => !taken.has(d)), taken };
}

/** For the picker: every free opponent with the battlefields open against them (legal ones first). */
export async function pickOptions(c: Campaign, roundId: string) {
	const p = await pairing(roundId);
	if (!p.picker) return null;
	const { state } = await loadCampaignState(c);
	return {
		picker: p.picker,
		opponents: p.free.map((d) => ({
			id: d,
			zones: zoneOptions(state, p.picker!, d)
				.filter((o) => o.legal)
				.map((o) => o.zone)
		}))
	};
}

/**
 * The Aggressor whose turn it is picks an opponent from the free non-Aggressors and a battlefield (any legal zone,
 * even one another battle already uses). When the last Aggressor has picked, the unpicked sit out and the battles begin.
 */
export async function pickOpponent(c: Campaign, roundId: string, aggressorId: string, defenderId: string, zone: string, override = false) {
	const [r] = await db.select().from(round).where(and(eq(round.id, roundId), eq(round.campaignId, c.id)));
	if (!r || r.step !== 'pairing') throw new RoundError('Opponents are not being picked now');
	const p = await pairing(r.id);
	if (p.picker !== aggressorId) throw new RoundError("It is not this warband's turn to pick");
	if (!p.free.includes(defenderId)) throw new RoundError('That warband is not free to be picked');
	const me = p.entries.find((e) => e.warbandId === aggressorId)!;
	try {
		await planGame(c, {
			aggressor: aggressorId,
			defender: defenderId,
			zone,
			override,
			roundId: r.id,
			aggressorReason: me.rolls.length > 1 || p.entries.some((e) => e.aggressions === me.aggressions && e.warbandId !== aggressorId) ? 'roll-off' : 'fewer'
		});
	} catch (e) {
		if (e instanceof BattleError) throw new RoundError(e.message);
		throw e;
	}
	const after = await pairing(r.id);
	if (!after.picker) {
		const sitting = byes(after.defenders, after.taken);
		if (sitting.length) await db.update(roundEntry).set({ role: 'bye' }).where(and(eq(roundEntry.roundId, r.id), inArray(roundEntry.warbandId, sitting)));
		await db.update(round).set({ step: 'battles' }).where(eq(round.id, r.id));
	}
	publish(c.id);
}

/** A battle of the round was cancelled: back to picking, the Aggressor's turn again. */
export async function afterGameCancelled(roundId: string) {
	const [r] = await db.select().from(round).where(eq(round.id, roundId));
	if (!r || r.step !== 'battles') return;
	await db.update(roundEntry).set({ role: 'defender' }).where(and(eq(roundEntry.roundId, roundId), eq(roundEntry.role, 'bye')));
	await db.update(round).set({ step: 'pairing' }).where(eq(round.id, roundId));
}

/** After a battle is recorded: close its round once all of the round's battles are, and open the next one. */
export async function afterGameRecorded(c: Campaign, gameId: string) {
	const [g] = await db.select({ roundId: game.roundId }).from(game).where(eq(game.id, gameId));
	if (!g?.roundId) return;
	const games = await db.select({ status: game.status }).from(game).where(eq(game.roundId, g.roundId));
	const [r] = await db.select().from(round).where(eq(round.id, g.roundId));
	if (!r || r.step !== 'battles' || games.some((x) => x.status !== 'done')) return;
	await db.update(round).set({ step: 'closed', closedAt: new Date() }).where(eq(round.id, r.id));
	const [fresh] = await db.select().from(campaign).where(eq(campaign.id, c.id));
	await openRound(fresh);
	publish(c.id);
}

/** Everything a screen needs to show the round: entries in rank order with roles, whose turn, the battles. */
export async function roundBoard(c: Campaign) {
	const r = await openRoundOf(c);
	const [latest] = r ? [r] : await db.select().from(round).where(eq(round.campaignId, c.id)).orderBy(desc(round.number)).limit(1);
	if (!latest) return null;
	const entries = await entriesOf(latest.id);
	const view = entries.map((e) => ({ id: e.warbandId, aggressions: e.aggressions, rolls: e.rolls }));
	const need = latest.step === 'rolling' ? rollOffNeeded(view) : { waiting: [], reroll: [] };
	const p = await pairing(latest.id);
	const order = rankEntries(view).map((e) => e.id);
	return {
		id: latest.id,
		number: latest.number,
		step: latest.step,
		entries: order.map((id) => {
			const e = entries.find((x) => x.warbandId === id)!;
			return { warbandId: id, aggressions: e.aggressions, rolls: e.rolls, role: e.role, pickOrder: e.pickOrder };
		}),
		waiting: need.waiting,
		reroll: need.reroll,
		picker: latest.step === 'pairing' ? p.picker : null,
		battles: p.games
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			.map((g) => ({ id: g.id, zone: g.zone, aggressor: g.aggressorId, defender: g.defenderId, status: g.status }))
	};
}

export async function roundEntriesFor(roundId: string) {
	return db.select().from(roundEntry).where(eq(roundEntry.roundId, roundId)).orderBy(asc(roundEntry.pickOrder));
}
