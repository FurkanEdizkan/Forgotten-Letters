import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from './db';
import { adjustment, campaign, challenge, game, round, roundEntry, warband } from './db/schema';
import { loadCampaignState, type Campaign } from './campaign';
import { BattleError, busyWarbands, passCounts, planGame, serverD6 } from './games';
export { passCounts };
import { publish, sendTrigger } from './hub';
import { zoneOptions } from '$lib/rules/legality';
import { assignRoles, freeOpponents, playerRound, rollOffByGroup, type GroupedEntry } from '$lib/rules/round';
import type { Effect } from '$lib/rules/types';

export class RoundError extends Error {}

/**
 * One step at a time: a transaction holds a Postgres advisory lock by name while the step re-reads the state and
 * acts, so a double tap, or a player and the Campaign Master at once, can't act twice on the same stale state.
 * (The step's own writes commit on their own; the lock only orders the steps.)
 */
function withLock<T>(name: string, step: () => Promise<T>): Promise<T> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${name}))`);
		return step();
	});
}
const withRoundLock = <T>(roundId: string, step: () => Promise<T>) => withLock(`round:${roundId}`, step);
const withCampaignLock = <T>(campaignId: string, step: () => Promise<T>) => withLock(`campaign:${campaignId}`, step);

export type Round = typeof round.$inferSelect;
export type Challenge = typeof challenge.$inferSelect;

/** Warbands in a pending challenge (either side): they can't be challenged again until it is answered. */
async function challengedWarbands(campaignId: string) {
	const rows = await db
		.select({ a: challenge.aggressorId, d: challenge.defenderId })
		.from(challenge)
		.where(and(eq(challenge.campaignId, campaignId), eq(challenge.status, 'pending')));
	return new Set(rows.flatMap((r) => [r.a, r.d]));
}

/** Every warband's own round and whether it can take on a battle now. */
export async function campaignStanding(c: Campaign) {
	const { state } = await loadCampaignState(c);
	const [busy, pending, passes] = await Promise.all([busyWarbands(c.id), challengedWarbands(c.id), passCounts(c.id)]);
	const rows = [...state.players.entries()].map(([id, p]) => {
		const passed = passes.get(id) ?? 0;
		return {
			id,
			games: p.games,
			passes: passed,
			round: playerRound(p.games, passed),
			left: c.gamesPerPlayer - p.games - passed,
			aggressions: p.aggression.length,
			busy: busy.has(id),
			challenged: pending.has(id)
		};
	});
	return { state, rows, byId: new Map(rows.map((r) => [r.id, r])) };
}

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

/** With nobody left to play and nothing on the field, the campaign is over. */
async function endIfDone(c: Campaign) {
	const { rows } = await campaignStanding(c);
	if (rows.length && rows.every((r) => r.left <= 0 && !r.busy)) {
		await db.update(campaign).set({ stage: 'ended' }).where(eq(campaign.id, c.id));
		publish(c.id);
	}
}

/**
 * Open the next round with every warband free to fight (games left, no battle or challenge pending), each in the
 * group of its own round. Nothing opens unless some group has two warbands to pair; a warband alone on its round
 * waits to arrange a battle, or for the Campaign Master to pass it.
 */
export async function openRound(c: Campaign): Promise<Round | null> {
	if (c.stage !== 'underway') throw new RoundError('Rounds begin once the campaign is under way');
	return withCampaignLock(c.id, async () => {
		if (await openRoundOf(c)) throw new RoundError('A round is already in progress');
		const { rows } = await campaignStanding(c);
		const free = rows.filter((r) => r.left > 0 && !r.busy && !r.challenged);
		const sizes = new Map<number, number>();
		for (const r of free) sizes.set(r.round, (sizes.get(r.round) ?? 0) + 1);
		if (![...sizes.values()].some((n) => n >= 2)) {
			await endIfDone(c);
			return null;
		}
		const [last] = await db.select({ number: round.number }).from(round).where(eq(round.campaignId, c.id)).orderBy(desc(round.number)).limit(1);
		const [r] = await db.insert(round).values({ campaignId: c.id, number: (last?.number ?? 0) + 1 }).returning();
		await db.insert(roundEntry).values(free.map((w) => ({ roundId: r.id, warbandId: w.id, aggressions: w.aggressions, playerRound: w.round })));
		publish(c.id);
		return r;
	});
}

async function entriesOf(roundId: string) {
	return db.select().from(roundEntry).where(eq(roundEntry.roundId, roundId));
}
const grouped = (entries: (typeof roundEntry.$inferSelect)[]): GroupedEntry[] =>
	entries.filter((e) => e.role !== 'passed').map((e) => ({ id: e.warbandId, aggressions: e.aggressions, rolls: e.rolls, round: e.playerRound }));

/** The warband rolls its D6 for the Aggressor roll-off (first roll, or a re-roll when tied within its group). */
export async function rollForAggressor(c: Campaign, roundId: string, warbandId: string) {
	return withRoundLock(roundId, async () => {
		const [r] = await db.select().from(round).where(and(eq(round.id, roundId), eq(round.campaignId, c.id)));
		if (!r || r.step !== 'rolling') throw new RoundError('The roll-off is over');
		const entries = await entriesOf(r.id);
		const me = entries.find((e) => e.warbandId === warbandId && e.role !== 'passed');
		if (!me) throw new RoundError('This warband sits out this round');
		const need = rollOffByGroup(grouped(entries));
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
	});
}

/** Once nobody is waiting and no tie decides anything, assign the roles and the picking order, group by group. */
async function settleRollOff(roundId: string) {
	const entries = await entriesOf(roundId);
	const view = grouped(entries);
	const need = rollOffByGroup(view);
	if (need.waiting.length || need.reroll.length) return;
	for (const [id, role] of assignRoles(view))
		await db.update(roundEntry).set(role).where(and(eq(roundEntry.roundId, roundId), eq(roundEntry.warbandId, id)));
	await db.update(round).set({ step: 'pairing' }).where(eq(round.id, roundId));
	await settlePairing(roundId);
}

/** Where the pairing stands: the roles, the round's battles and challenges, and whose turn it is. */
async function pairing(roundId: string) {
	const entries = await entriesOf(roundId);
	const view = grouped(entries);
	const roles = new Map(
		entries.filter((e) => e.role === 'aggressor' || e.role === 'defender').map((e) => [e.warbandId, { role: e.role as 'aggressor' | 'defender', pickOrder: e.pickOrder }])
	);
	const games = await db.select().from(game).where(eq(game.roundId, roundId));
	const challenges = await db.select().from(challenge).where(eq(challenge.roundId, roundId));
	const pending = challenges.filter((x) => x.status === 'pending');
	const taken = new Set([...games.flatMap((g) => [g.aggressorId, g.defenderId]), ...pending.flatMap((x) => [x.aggressorId, x.defenderId])]);
	const declined = new Set(challenges.filter((x) => x.status === 'declined').map((x) => `${x.aggressorId}>${x.defenderId}`));
	const aggressors = entries
		.filter((e) => e.role === 'aggressor')
		.sort((a, b) => (a.pickOrder ?? 0) - (b.pickOrder ?? 0))
		.map((e) => e.warbandId);
	const options = (id: string) => freeOpponents(id, view, roles, { taken, declined });
	// The first Aggressor in order who has neither a battle nor a challenge out, and still someone to challenge.
	const picker = aggressors.find((id) => !taken.has(id) && options(id).length) ?? null;
	return { entries, games, pending, taken, picker, options };
}

/** When nobody can pick any more and no challenge is waiting, the unpaired sit this round out and the battles begin. */
async function settlePairing(roundId: string) {
	const [r] = await db.select().from(round).where(eq(round.id, roundId));
	if (!r || r.step !== 'pairing') return;
	const p = await pairing(roundId);
	if (p.picker || p.pending.length) return;
	const fighting = new Set(p.games.flatMap((g) => [g.aggressorId, g.defenderId]));
	const idle = p.entries.filter((e) => e.role !== 'passed' && !fighting.has(e.warbandId)).map((e) => e.warbandId);
	if (idle.length) await db.update(roundEntry).set({ role: 'bye' }).where(and(eq(roundEntry.roundId, roundId), inArray(roundEntry.warbandId, idle)));
	// No battle came of it (every challenge declined, say): the round is over at once. The next one is opened by
	// the Campaign Master, so a round nobody can pair can't reopen itself in a loop.
	const done = !p.games.length;
	await db
		.update(round)
		.set(done ? { step: 'closed', closedAt: new Date() } : { step: 'battles' })
		.where(eq(round.id, roundId));
}

/** For the picker: the opponents they may challenge and the battlefields open against each. */
export async function pickOptions(c: Campaign, roundId: string) {
	const p = await pairing(roundId);
	if (!p.picker) return null;
	const { state } = await loadCampaignState(c);
	return {
		picker: p.picker,
		opponents: p.options(p.picker).map((d) => ({
			id: d,
			zones: zoneOptions(state, p.picker!, d)
				.filter((o) => o.legal)
				.map((o) => o.zone)
		}))
	};
}

/** Everyone the warband may challenge right now, outside a round, with the battlefields open against each. */
export async function anytimeOptions(c: Campaign, aggressorId: string) {
	const { state, rows, byId } = await campaignStanding(c);
	const me = byId.get(aggressorId);
	if (!me || me.left <= 0 || me.busy || me.challenged) return null;
	return {
		aggressor: aggressorId,
		opponents: rows
			.filter((r) => r.id !== aggressorId && r.left > 0 && !r.busy && !r.challenged)
			.map((r) => ({
				id: r.id,
				round: r.round,
				zones: zoneOptions(state, aggressorId, r.id)
					.filter((o) => o.legal)
					.map((o) => o.zone)
			}))
	};
}

async function checkZone(c: Campaign, aggressor: string, defender: string, zone: string, override: boolean) {
	const { state } = await loadCampaignState(c);
	const o = zoneOptions(state, aggressor, defender).find((x) => x.zone === zone);
	if (!o) throw new RoundError('Choose a battlefield');
	if (!o.legal && !override) throw new RoundError(`${zone}: ${o.reason}`);
}

/**
 * The Aggressor whose turn it is challenges a free non-Aggressor of the same round on a legal battlefield (any
 * zone, even one another battle already uses). The battle appears once the opponent accepts.
 */
export async function pickOpponent(c: Campaign, roundId: string, aggressorId: string, defenderId: string, zone: string, override = false) {
	return withRoundLock(roundId, async () => {
		const [r] = await db.select().from(round).where(and(eq(round.id, roundId), eq(round.campaignId, c.id)));
		if (!r || r.step !== 'pairing') throw new RoundError('Opponents are not being picked now');
		const p = await pairing(r.id);
		if (p.picker !== aggressorId) throw new RoundError("It is not this warband's turn to pick");
		if (!p.options(aggressorId).includes(defenderId)) throw new RoundError('That warband is not free to be challenged');
		await checkZone(c, aggressorId, defenderId, zone, override);
		await db.insert(challenge).values({ campaignId: c.id, roundId: r.id, aggressorId, defenderId, zone });
		publish(c.id);
	});
}

/** A battle arranged by the players themselves, at any time: the challenger is the Aggressor. */
export async function challengeAnytime(c: Campaign, aggressorId: string, defenderId: string, zone: string, override = false) {
	if (c.stage !== 'underway') throw new RoundError('Battles begin once the campaign is under way');
	return withCampaignLock(c.id, async () => {
		const options = await anytimeOptions(c, aggressorId);
		if (!options) throw new RoundError('This warband is already in a battle or a challenge, or has no games left');
		if (!options.opponents.some((o) => o.id === defenderId)) throw new RoundError('That warband is not free to be challenged');
		await checkZone(c, aggressorId, defenderId, zone, override);
		await db.insert(challenge).values({ campaignId: c.id, aggressorId, defenderId, zone });
		publish(c.id);
	});
}

/** The opponent answers. Accepted: the battle goes on the map. Declined: the Aggressor challenges someone else. */
export async function answerChallenge(c: Campaign, challengeId: string, accept: boolean) {
	const [x] = await db.select().from(challenge).where(and(eq(challenge.id, challengeId), eq(challenge.campaignId, c.id)));
	if (!x) throw new RoundError('No such challenge');
	return withLock(x.roundId ? `round:${x.roundId}` : `campaign:${c.id}`, async () => {
		const [fresh] = await db.select().from(challenge).where(eq(challenge.id, challengeId));
		if (fresh.status !== 'pending') throw new RoundError('This challenge has been answered already');
		if (!accept) {
			await db.update(challenge).set({ status: 'declined', answeredAt: new Date() }).where(eq(challenge.id, x.id));
		} else {
			let reason: 'fewer' | 'roll-off' | 'chosen' = 'chosen';
			if (x.roundId) {
				const entries = await entriesOf(x.roundId);
				const a = entries.find((e) => e.warbandId === x.aggressorId)?.aggressions ?? 0;
				const d = entries.find((e) => e.warbandId === x.defenderId)?.aggressions ?? 0;
				reason = a < d ? 'fewer' : 'roll-off';
			}
			try {
				const g = await planGame(c, { aggressor: x.aggressorId, defender: x.defenderId, zone: x.zone, override: true, roundId: x.roundId ?? undefined, aggressorReason: reason });
				await db.update(challenge).set({ status: 'accepted', answeredAt: new Date(), gameId: g.id }).where(eq(challenge.id, x.id));
			} catch (e) {
				if (e instanceof BattleError) throw new RoundError(e.message);
				throw e;
			}
		}
		if (x.roundId) await settlePairing(x.roundId);
		publish(c.id);
	});
}

/** The Aggressor takes a pending challenge back. */
export async function withdrawChallenge(c: Campaign, challengeId: string) {
	const [x] = await db.select().from(challenge).where(and(eq(challenge.id, challengeId), eq(challenge.campaignId, c.id)));
	if (!x) throw new RoundError('No such challenge');
	return withLock(x.roundId ? `round:${x.roundId}` : `campaign:${c.id}`, async () => {
		const done = await db
			.update(challenge)
			.set({ status: 'withdrawn', answeredAt: new Date() })
			.where(and(eq(challenge.id, x.id), eq(challenge.status, 'pending')))
			.returning({ id: challenge.id });
		if (!done.length) throw new RoundError('This challenge has been answered already');
		if (x.roundId) await settlePairing(x.roundId);
		publish(c.id);
	});
}

export async function findChallenge(c: Campaign, challengeId: string) {
	const [x] = await db.select().from(challenge).where(and(eq(challenge.id, challengeId), eq(challenge.campaignId, c.id)));
	return x ?? null;
}

/** A battle of the round was cancelled: back to picking, the Aggressor challenges again. */
export async function afterGameCancelled(roundId: string) {
	await withRoundLock(roundId, async () => {
		const [r] = await db.select().from(round).where(eq(round.id, roundId));
		if (!r || r.step !== 'battles') return;
		await db.update(roundEntry).set({ role: 'defender' }).where(and(eq(roundEntry.roundId, roundId), eq(roundEntry.role, 'bye')));
		await db.update(round).set({ step: 'pairing' }).where(eq(round.id, roundId));
		await settlePairing(roundId);
	});
}

/** After a battle is recorded: close its round once all of the round's battles are, and open the next one. */
export async function afterGameRecorded(c: Campaign, gameId: string) {
	const [g] = await db.select({ roundId: game.roundId }).from(game).where(eq(game.id, gameId));
	if (g?.roundId) await closeRoundIfDone(c, g.roundId);
	else await endIfDone(c);
}

/** Close the round once every one of its battles is recorded (or gone), and open the next. Safe to call again. */
export async function closeRoundIfDone(c: Campaign, roundId: string) {
	const closedNow = await withRoundLock(roundId, async () => {
		const games = await db.select({ status: game.status }).from(game).where(eq(game.roundId, roundId));
		if (games.some((x) => x.status !== 'done')) return false;
		// Only the request that actually closes the round opens the next one (two results recorded at once).
		const closed = await db
			.update(round)
			.set({ step: 'closed', closedAt: new Date() })
			.where(and(eq(round.id, roundId), eq(round.step, 'battles')))
			.returning({ id: round.id });
		return closed.length > 0;
	});
	if (closedNow) {
		const [fresh] = await db.select().from(campaign).where(eq(campaign.id, c.id));
		await openRound(fresh).catch((e) => {
			if (!(e instanceof RoundError)) throw e;
		});
	}
	publish(c.id);
}

/** The penalty set in the campaign settings, as rules-engine effects (all taken away). */
export function penaltyEffects(c: Campaign): Effect[] {
	const p = c.passPenalty;
	const out: Effect[] = [];
	if (p.cvp) out.push({ t: 'cvp', n: -Math.abs(p.cvp) });
	if (p.glory) out.push({ t: 'glory', n: -Math.abs(p.glory) });
	if (p.ducats) out.push({ t: 'ducats', n: -Math.abs(p.ducats) });
	for (const [track, n] of Object.entries(p.boxes ?? {}))
		for (let i = 0; i < Math.abs(n ?? 0); i++) out.push({ t: 'unfill', track: track as 'F' | 'R' | 'S' | 'T' });
	return out;
}

/**
 * The Campaign Master passes a warband for its round: it counts as a game played and moves it on a round. Unless
 * excused, the campaign's penalty is taken. Recorded as an adjustment, so it shows (and can be undone) there.
 */
export async function passWarband(c: Campaign, warbandId: string, { excused, note }: { excused: boolean; note: string | null }) {
	return withCampaignLock(c.id, async () => {
		const { byId } = await campaignStanding(c);
		const w = byId.get(warbandId);
		if (!w) throw new RoundError('No such warband');
		if (w.left <= 0) throw new RoundError('This warband has no games left to pass');
		if (w.busy || w.challenged) throw new RoundError('This warband has a battle or a challenge in hand: settle that first');
		const effects = excused ? [] : penaltyEffects(c);
		await db.insert(adjustment).values({
			campaignId: c.id,
			warbandId,
			kind: 'round-pass',
			payload: { effects, round: w.round, excused },
			note: note || `Round ${w.round} passed${excused ? ' (excused)' : ' — penalty'}`
		});
		// Out of any roll-off or pairing still going on.
		const r = await openRoundOf(c);
		if (r) {
			await db.update(roundEntry).set({ role: 'passed' }).where(and(eq(roundEntry.roundId, r.id), eq(roundEntry.warbandId, warbandId)));
			if (r.step === 'rolling') await settleRollOff(r.id);
			else if (r.step === 'pairing') await settlePairing(r.id);
		}
		publish(c.id);
		return { round: w.round, effects };
	});
}

/** Everything a screen needs to show the round: entries in order with roles, whose turn it is, the battles. */
export async function roundBoard(c: Campaign) {
	const r = await openRoundOf(c);
	const [latest] = r ? [r] : await db.select().from(round).where(eq(round.campaignId, c.id)).orderBy(desc(round.number)).limit(1);
	if (!latest) return null;
	const entries = await entriesOf(latest.id);
	const view = grouped(entries);
	const need = latest.step === 'rolling' ? rollOffByGroup(view) : { waiting: [], reroll: [] };
	const p = await pairing(latest.id);
	// Behind first, then by standing within the group (Aggressors in picking order).
	const order = [...entries].sort(
		(a, b) => a.playerRound - b.playerRound || (a.pickOrder ?? 99) - (b.pickOrder ?? 99) || (b.rolls.at(-1) ?? 0) - (a.rolls.at(-1) ?? 0)
	);
	return {
		id: latest.id,
		number: latest.number,
		step: latest.step,
		entries: order.map((e) => ({ warbandId: e.warbandId, aggressions: e.aggressions, rolls: e.rolls, role: e.role, pickOrder: e.pickOrder, playerRound: e.playerRound })),
		waiting: need.waiting,
		reroll: need.reroll,
		picker: latest.step === 'pairing' ? p.picker : null,
		battles: p.games
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			.map((g) => ({ id: g.id, zone: g.zone, aggressor: g.aggressorId, defender: g.defenderId, status: g.status }))
	};
}

/** Challenges waiting for an answer, round ones and anytime ones alike. */
export async function pendingChallenges(c: Campaign) {
	return db
		.select({ id: challenge.id, roundId: challenge.roundId, aggressor: challenge.aggressorId, defender: challenge.defenderId, zone: challenge.zone })
		.from(challenge)
		.where(and(eq(challenge.campaignId, c.id), eq(challenge.status, 'pending')))
		.orderBy(asc(challenge.createdAt));
}

// Kept for callers that list a round's entries in picking order.
export async function roundEntriesFor(roundId: string) {
	return db.select().from(roundEntry).where(eq(roundEntry.roundId, roundId)).orderBy(asc(roundEntry.pickOrder));
}

