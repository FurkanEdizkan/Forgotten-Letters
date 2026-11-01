/** Seats and seat links. The only SQL for campaign.seats and campaign.seat_invites. */
import { and, asc, eq, gt, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { seatInvites, seats, users, type Seat, type SeatInvite } from '../db/schema';

export type SeatRow = Seat;
export type SeatInviteRow = SeatInvite;

export const defaultName = (number: number) => `Seat ${number}`;

/** Add `count` seats numbered on from `from`, each with its default name. */
export function insertMany(tx: Tx, campaignId: string, from: number, count: number) {
	const rows = Array.from({ length: count }, (_, i) => ({
		campaignId,
		number: from + i,
		name: defaultName(from + i)
	}));
	return tx.insert(seats).values(rows).returning();
}

/** A seat's open link: not used, not withdrawn, not expired (links without an expiry last until used). */
const linkIsOpen = and(
	eq(seatInvites.seatId, seats.id),
	isNull(seatInvites.usedAt),
	isNull(seatInvites.revokedAt),
	or(isNull(seatInvites.expiresAt), gt(seatInvites.expiresAt, sql`now()`))
);

export interface SeatView {
	seat: Seat;
	playerName: string | null;
	/** The seat's open link, if any (a seat has at most one: making a link withdraws the old one). */
	link: { tokenEnc: string | null; createdAt: Date; openedAt: Date | null } | null;
}

const viewFields = {
	seat: seats,
	playerName: users.displayName,
	link: {
		id: seatInvites.id,
		tokenEnc: seatInvites.tokenEnc,
		createdAt: seatInvites.createdAt,
		openedAt: seatInvites.openedAt
	}
};

const viewQuery = (tx: Tx) =>
	tx
		.select(viewFields)
		.from(seats)
		.leftJoin(users, eq(users.id, seats.userId))
		.leftJoin(seatInvites, linkIsOpen);

type ViewRow = Awaited<ReturnType<typeof viewQuery>>[number];
const toView = (r: ViewRow): SeatView => ({
	seat: r.seat,
	playerName: r.playerName,
	link: r.link?.id
		? { tokenEnc: r.link.tokenEnc, createdAt: r.link.createdAt!, openedAt: r.link.openedAt }
		: null
});

/** A campaign's seats in number order, with the player's display name and the open link. */
export async function list(tx: Tx, campaignId: string): Promise<SeatView[]> {
	const rows = await viewQuery(tx)
		.where(eq(seats.campaignId, campaignId))
		.orderBy(asc(seats.number));
	return rows.map(toView);
}

export async function view(tx: Tx, id: string): Promise<SeatView> {
	const [r] = await viewQuery(tx).where(eq(seats.id, id));
	return toView(r!);
}

/** A seat of this campaign, locked for this transaction. */
export async function lock(tx: Tx, campaignId: string, id: string) {
	const [s] = await tx
		.select()
		.from(seats)
		.where(and(eq(seats.id, id), eq(seats.campaignId, campaignId)))
		.for('update');
	return s ?? null;
}

export const findById = async (tx: Tx, id: string) =>
	(await tx.select().from(seats).where(eq(seats.id, id)))[0] ?? null;

/** How many seats and the highest number. */
export async function count(tx: Tx, campaignId: string) {
	const [r] = await tx
		.select({
			total: sql<number>`count(*)::int`,
			taken: sql<number>`count(${seats.userId})::int`,
			max: sql<number>`coalesce(max(${seats.number}), 0)::int`
		})
		.from(seats)
		.where(eq(seats.campaignId, campaignId));
	return r!;
}

/** The seat a person holds in a campaign, if any. */
export const seatOf = async (tx: Tx, campaignId: string, userId: string) =>
	(
		await tx
			.select()
			.from(seats)
			.where(and(eq(seats.campaignId, campaignId), eq(seats.userId, userId)))
	)[0] ?? null;

export const emptySeats = (tx: Tx, campaignId: string) =>
	tx
		.select()
		.from(seats)
		.where(and(eq(seats.campaignId, campaignId), isNull(seats.userId)))
		.orderBy(asc(seats.number));

/** Update and bump the version; with `version`, only if nobody changed the row since (else null). */
export async function update(
	tx: Tx,
	id: string,
	fields: Partial<Pick<Seat, 'name' | 'userId' | 'joinedAt'>>,
	version?: number
) {
	const [s] = await tx
		.update(seats)
		.set({ ...fields, version: sql`${seats.version} + 1` })
		.where(
			version === undefined ? eq(seats.id, id) : and(eq(seats.id, id), eq(seats.version, version))
		)
		.returning();
	return s ?? null;
}

/** Remove a seat only while it is empty; false if it was taken. */
export async function removeEmpty(tx: Tx, id: string) {
	const r = await tx
		.delete(seats)
		.where(and(eq(seats.id, id), isNull(seats.userId)))
		.returning({ id: seats.id });
	return r.length > 0;
}

/** Active accounts matching `q` (username or display name) without a seat in the campaign; up to 10. */
export function candidates(tx: Tx, campaignId: string, q: string) {
	const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
	return tx
		.select({ id: users.id, displayName: users.displayName, username: users.username })
		.from(users)
		.where(
			and(
				isNull(users.disabledAt),
				isNull(users.anonymisedAt),
				or(ilike(users.username, like), ilike(users.displayName, like)),
				sql`not exists (select 1 from campaign.seats s where s.campaign_id = ${campaignId} and s.user_id = ${sql.raw('"auth"."users"."id"')})`
			)
		)
		.orderBy(asc(users.displayName))
		.limit(10);
}

// ---------------------------------------------------------------- seat links

export async function insertInvite(tx: Tx, row: typeof seatInvites.$inferInsert) {
	const [i] = await tx.insert(seatInvites).values(row).returning();
	return i!;
}

export const findInviteByToken = async (tx: Tx, tokenHash: string) =>
	(await tx.select().from(seatInvites).where(eq(seatInvites.tokenHash, tokenHash)))[0] ?? null;

/** The link for a token hash, locked for this transaction (taking a seat runs once). */
export async function lockInviteByToken(tx: Tx, tokenHash: string) {
	const [i] = await tx
		.select()
		.from(seatInvites)
		.where(eq(seatInvites.tokenHash, tokenHash))
		.for('update');
	return i ?? null;
}

/** Revoke every open link of a campaign's seats ("Withdraw all links"); returns how many. */
export async function revokeAllOpen(tx: Tx, campaignId: string) {
	const r = await tx
		.update(seatInvites)
		.set({ revokedAt: new Date() })
		.where(
			and(
				isNull(seatInvites.usedAt),
				isNull(seatInvites.revokedAt),
				sql`${seatInvites.seatId} in (select id from campaign.seats where campaign_id = ${campaignId})`
			)
		)
		.returning({ id: seatInvites.id });
	return r.length;
}

/** The first time a link page opens. */
export const markInviteOpened = (tx: Tx, id: string) =>
	tx
		.update(seatInvites)
		.set({ openedAt: new Date() })
		.where(and(eq(seatInvites.id, id), isNull(seatInvites.openedAt)));

export const markInviteUsed = (tx: Tx, id: string, userId: string) =>
	tx.update(seatInvites).set({ usedAt: new Date(), usedBy: userId }).where(eq(seatInvites.id, id));

/** Revoke the seat's open (unused, unrevoked) links; returns how many. */
export async function revokeOpen(tx: Tx, seatId: string) {
	const r = await tx
		.update(seatInvites)
		.set({ revokedAt: new Date() })
		.where(
			and(eq(seatInvites.seatId, seatId), isNull(seatInvites.usedAt), isNull(seatInvites.revokedAt))
		)
		.returning({ id: seatInvites.id });
	return r.length;
}

/**
 * Unused links that expired or were revoked before `before` (kept a while so the link page can still say "expired"
 * or "withdrawn"); used ones stay, they show how a player joined.
 */
export const removeStaleInvites = (tx: Tx, before: Date) =>
	tx
		.delete(seatInvites)
		.where(
			and(
				isNull(seatInvites.usedAt),
				or(lt(seatInvites.expiresAt, before), lt(seatInvites.revokedAt, before))
			)
		);
