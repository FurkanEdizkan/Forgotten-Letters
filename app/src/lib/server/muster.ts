import { randomInt } from 'node:crypto';
import { openRound } from './rounds';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from './db';
import { campaign, invite, player, user, warband } from './db/schema';
import type { Campaign } from './campaign';
import { hashPassword, newToken, tokenHash } from './passwords';
import { checkSignup, type SignupInput } from './request-rules';
import { publish } from './hub';
import { VISIONS } from '$lib/rules/visions';
import { canStartCampaign, dealVisionOffers, inviteState, musterSteps, nextStage, type InviteState, type Stage } from '$lib/campaign-flow';
import { suggestedEntry } from '$lib/seating';

const INVITE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export interface Seat {
	playerId: string;
	seat: number | null;
	name: string;
	/** The seat's suggested Entry Zone, from its number and the campaign's size. */
	suggestedEntry: string;
	account: { id: string; username: string } | null;
	warband: { id: string; name: string; faction: string; entryZone: string | null; visionCard: string | null; visionOffer: string[] | null } | null;
	invite: { id: string; state: InviteState; expiresAt: Date; usedAt: Date | null } | null;
	steps: ReturnType<typeof musterSteps>;
}

/** Every seat of the campaign with its account, warband, latest invite and mustering progress, in seat order. */
export async function listSeats(c: Campaign): Promise<Seat[]> {
	const rows = await db
		.select({ p: player, u: { id: user.id, username: user.username }, w: warband })
		.from(player)
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(warband, and(eq(warband.playerId, player.id), eq(warband.campaignId, c.id)))
		.where(eq(player.campaignId, c.id))
		.orderBy(asc(player.seat), asc(player.name));
	const invites = await db.select().from(invite).where(eq(invite.campaignId, c.id)).orderBy(desc(invite.createdAt));
	return rows.map(({ p, u, w }) => {
		const latest = invites.find((i) => i.playerId === p.id);
		return {
			playerId: p.id,
			seat: p.seat,
			name: p.name,
			suggestedEntry: suggestedEntry(p.seat, c.expectedPlayers, c.houseZones),
			account: u?.id ? { id: u.id, username: u.username } : null,
			warband: w
				? { id: w.id, name: w.name, faction: w.faction, entryZone: w.entryZone, visionCard: w.visionCard, visionOffer: w.visionOffer ?? null }
				: null,
			invite: latest ? { id: latest.id, state: inviteState(latest), expiresAt: latest.expiresAt, usedAt: latest.usedAt } : null,
			steps: musterSteps({ hasAccount: !!u?.id, hasWarband: !!w, visionOffered: !!w?.visionOffer?.length, visionChosen: !!w?.visionCard })
		};
	});
}

/** Make sure seats 1…n exist ("Seat 3" until renamed); seats already there are kept as they are. */
export async function ensureSeats(c: Campaign, n: number) {
	const have = new Set((await db.select({ seat: player.seat }).from(player).where(eq(player.campaignId, c.id))).map((p) => p.seat));
	const missing = Array.from({ length: n }, (_, i) => i + 1).filter((s) => !have.has(s));
	if (missing.length) await db.insert(player).values(missing.map((seat) => ({ campaignId: c.id, seat, name: `Seat ${seat}` })));
	return missing.length;
}

/** A new invite link for one seat, replacing any earlier one that is still open. Returns the token (shown once). */
export async function issueInvite(c: Campaign, playerId: string, createdBy: string | null) {
	const [seat] = await db.select().from(player).where(and(eq(player.id, playerId), eq(player.campaignId, c.id)));
	if (!seat) return { ok: false as const, message: 'No such seat.' };
	if (seat.userId) return { ok: false as const, message: 'Someone already plays this seat.' };
	await db
		.update(invite)
		.set({ revokedAt: new Date() })
		.where(and(eq(invite.playerId, playerId), isNull(invite.usedAt), isNull(invite.revokedAt)));
	const token = newToken();
	await db.insert(invite).values({ campaignId: c.id, playerId, tokenHash: tokenHash(token), createdBy, expiresAt: new Date(Date.now() + INVITE_DAYS * DAY) });
	return { ok: true as const, token };
}

export async function revokeInvite(c: Campaign, inviteId: string) {
	await db
		.update(invite)
		.set({ revokedAt: new Date() })
		.where(and(eq(invite.id, inviteId), eq(invite.campaignId, c.id), isNull(invite.usedAt)));
}

/** What an invite link points at, and whether it can still be used. */
export async function lookupInvite(token: string) {
	if (!token || token.length > 100) return null;
	const [row] = await db
		.select({ i: invite, p: player, c: campaign })
		.from(invite)
		.innerJoin(player, eq(player.id, invite.playerId))
		.innerJoin(campaign, eq(campaign.id, invite.campaignId))
		.where(eq(invite.tokenHash, tokenHash(token)));
	if (!row) return null;
	const state: InviteState = row.p.userId && inviteState(row.i) === 'valid' ? 'used' : inviteState(row.i);
	return { invite: row.i, seat: row.p, campaign: row.c, state };
}

/** Take the seat an invite names: a new player account, already tied to the seat. */
export async function redeemInvite(token: string, input: SignupInput): Promise<{ ok: true; userId: string; seatName: string } | { ok: false; message: string }> {
	const checked = checkSignup(input);
	if (!checked.ok) return checked;
	const { username, displayName, email, password } = checked.value;
	const passwordHash = await hashPassword(password);
	return db.transaction(async (tx) => {
		const [row] = await tx
			.select({ i: invite, p: player })
			.from(invite)
			.innerJoin(player, eq(player.id, invite.playerId))
			.where(eq(invite.tokenHash, tokenHash(token)))
			.for('update');
		if (!row || inviteState(row.i) !== 'valid' || row.p.userId) return { ok: false as const, message: 'This invite link can no longer be used. Ask the Campaign Master for a new one.' };
		if ((await tx.select({ id: user.id }).from(user).where(eq(user.username, username))).length)
			return { ok: false as const, message: 'That username is taken. Choose another.' };
		if (email && (await tx.select({ id: user.id }).from(user).where(eq(user.email, email))).length)
			return { ok: false as const, message: 'That email address already belongs to an account.' };
		const [u] = await tx
			.insert(user)
			.values({ username, displayName, email, passwordHash, role: 'player', mustChangePassword: false })
			.onConflictDoNothing()
			.returning({ id: user.id });
		// Someone took the username (or email) in the moment since the check above.
		if (!u) return { ok: false as const, message: 'That username or email was just taken. Choose another.' };
		// The seat takes the player's name unless the Campaign Master named it already.
		const seatName = /^Seat \d+$/.test(row.p.name) ? (displayName ?? username) : row.p.name;
		await tx.update(player).set({ userId: u.id, name: seatName }).where(eq(player.id, row.p.id));
		await tx.update(invite).set({ usedAt: new Date(), usedBy: u.id }).where(eq(invite.id, row.i.id));
		return { ok: true as const, userId: u.id, seatName };
	});
}

/** Deal two Vision cards to every campaign warband still without a Vision or an offer. Returns how many were dealt. */
export async function dealVisions(c: Campaign) {
	const bands = await db
		.select({ id: warband.id, visionCard: warband.visionCard, visionOffer: warband.visionOffer })
		.from(warband)
		.where(eq(warband.campaignId, c.id));
	const deal = dealVisionOffers(
		bands.map((b) => ({ ...b, visionOffer: b.visionOffer ?? null })),
		VISIONS.map((v) => v.id),
		() => randomInt(1_000_000) / 1_000_000
	);
	for (const [id, offer] of Object.entries(deal)) await db.update(warband).set({ visionOffer: offer }).where(eq(warband.id, id));
	return Object.keys(deal).length;
}

/** Keep one of the two cards offered (the player, or the Campaign Master for them). */
export async function chooseVision(c: Campaign, warbandId: string, card: string) {
	const [w] = await db.select().from(warband).where(and(eq(warband.id, warbandId), eq(warband.campaignId, c.id)));
	if (!w) return { ok: false as const, message: 'No such warband.' };
	if (w.visionCard) return { ok: false as const, message: 'This warband has chosen its Vision already.' };
	if (!w.visionOffer?.includes(card)) return { ok: false as const, message: 'That card was not offered to this warband.' };
	// Only while still unchosen: a double tap can't keep two cards.
	const kept = await db
		.update(warband)
		.set({ visionCard: card, visionProgress: 0 })
		.where(and(eq(warband.id, w.id), isNull(warband.visionCard)))
		.returning({ id: warband.id });
	if (!kept.length) return { ok: false as const, message: 'This warband has chosen its Vision already.' };
	return { ok: true as const };
}

/** Move the campaign on to its next stage, checking what that step needs. */
export async function advanceStage(c: Campaign, override = false): Promise<{ ok: true; stage: Stage } | { ok: false; message: string }> {
	const next = nextStage(c.stage);
	if (!next) return { ok: false, message: 'The campaign has ended.' };
	if (next === 'mustering') {
		const seats = await listSeats(c);
		if (seats.length < 2) return { ok: false, message: 'Create the seats first (at least two).' };
	}
	if (next === 'underway') {
		const check = canStartCampaign((await listSeats(c)).map((s) => s.steps), override);
		if (!check.ok) return check;
	}
	await db.update(campaign).set({ stage: next }).where(eq(campaign.id, c.id));
	// Under way: the first round of battles opens at once.
	if (next === 'underway') await openRound({ ...c, stage: next });
	publish(c.id);
	return { ok: true, stage: next };
}

/** The seat a signed-in user plays, if any. */
export async function seatOf(c: Campaign, userId: string) {
	const [p] = await db.select().from(player).where(and(eq(player.campaignId, c.id), eq(player.userId, userId)));
	return p ?? null;
}

