/** Sessions. The only SQL for auth.sessions. */
import { and, desc, eq, gt, lt, ne } from 'drizzle-orm';
import type { Tx } from '../db';
import { sessions, users } from '../db/schema';

export const insert = (tx: Tx, row: typeof sessions.$inferInsert) =>
	tx.insert(sessions).values(row);

/** The live session and its user for a token hash. */
export async function findLive(tx: Tx, idHash: string) {
	const [r] = await tx
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.idHash, idHash), gt(sessions.expiresAt, new Date())));
	return r ?? null;
}

export const slide = (tx: Tx, idHash: string, expiresAt: Date) =>
	tx.update(sessions).set({ expiresAt, lastSeenAt: new Date() }).where(eq(sessions.idHash, idHash));

export const remove = (tx: Tx, idHash: string) =>
	tx.delete(sessions).where(eq(sessions.idHash, idHash));

/** End every session of a user, or every one except `keep`. */
export const removeForUser = (tx: Tx, userId: string, keep?: string) =>
	tx
		.delete(sessions)
		.where(and(eq(sessions.userId, userId), keep ? ne(sessions.idHash, keep) : undefined));

export const listForUser = (tx: Tx, userId: string) =>
	tx
		.select()
		.from(sessions)
		.where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
		.orderBy(desc(sessions.lastSeenAt));

export const removeExpired = (tx: Tx) =>
	tx.delete(sessions).where(lt(sessions.expiresAt, new Date()));
