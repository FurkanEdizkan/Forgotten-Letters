/** The audit log: append-only. The only SQL for auth.audit_log. */
import { and, desc, eq, lt } from 'drizzle-orm';
import type { Tx } from '../db';
import { auditLog, users } from '../db/schema';

export const insert = (tx: Tx, row: typeof auditLog.$inferInsert) =>
	tx.insert(auditLog).values(row);

/** Newest first, paged by id; optionally one action. */
export function page(
	tx: Tx,
	{ before, limit, action }: { before?: number; limit: number; action?: string }
) {
	return tx
		.select({ entry: auditLog, actorName: users.displayName })
		.from(auditLog)
		.leftJoin(users, eq(users.id, auditLog.actorId))
		.where(
			and(
				before ? lt(auditLog.id, before) : undefined,
				action ? eq(auditLog.action, action) : undefined
			)
		)
		.orderBy(desc(auditLog.id))
		.limit(limit);
}

export const removeOlderThan = (tx: Tx, date: Date) =>
	tx.delete(auditLog).where(lt(auditLog.at, date));
