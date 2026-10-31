/** Requests to join a listed campaign. The only SQL for campaign.join_requests. */
import { and, asc, eq } from 'drizzle-orm';
import type { Tx } from '../db';
import { joinRequests, users, type JoinRequest } from '../db/schema';

export type JoinRequestRow = JoinRequest;

export async function insert(tx: Tx, row: { campaignId: string; userId: string; note: string }) {
	// The partial unique index (one open request per person) is the only possible conflict: null means "already open".
	const [r] = await tx.insert(joinRequests).values(row).onConflictDoNothing().returning();
	return r ?? null;
}

export async function lock(tx: Tx, campaignId: string, id: string) {
	const [r] = await tx
		.select()
		.from(joinRequests)
		.where(and(eq(joinRequests.id, id), eq(joinRequests.campaignId, campaignId)))
		.for('update');
	return r ?? null;
}

export const findOpen = async (tx: Tx, campaignId: string, userId: string) =>
	(
		await tx
			.select()
			.from(joinRequests)
			.where(
				and(
					eq(joinRequests.campaignId, campaignId),
					eq(joinRequests.userId, userId),
					eq(joinRequests.status, 'open')
				)
			)
	)[0] ?? null;

/** Open requests, oldest first, with the person asking. */
export function listOpen(tx: Tx, campaignId: string) {
	return tx
		.select({
			request: joinRequests,
			displayName: users.displayName,
			username: users.username
		})
		.from(joinRequests)
		.innerJoin(users, eq(users.id, joinRequests.userId))
		.where(and(eq(joinRequests.campaignId, campaignId), eq(joinRequests.status, 'open')))
		.orderBy(asc(joinRequests.createdAt));
}

/** Close a person's open request once they hold a seat some other way (no decider). */
export const closeOpenFor = (tx: Tx, campaignId: string, userId: string) =>
	tx
		.update(joinRequests)
		.set({ status: 'withdrawn', decidedAt: new Date() })
		.where(
			and(
				eq(joinRequests.campaignId, campaignId),
				eq(joinRequests.userId, userId),
				eq(joinRequests.status, 'open')
			)
		);

export const decide = (
	tx: Tx,
	id: string,
	status: 'approved' | 'declined' | 'withdrawn',
	by: string
) =>
	tx
		.update(joinRequests)
		.set({ status, decidedBy: by, decidedAt: new Date() })
		.where(eq(joinRequests.id, id));
