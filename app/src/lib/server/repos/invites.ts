/** Invites and first-owner setup tokens. The only SQL for auth.invites and auth.setup_tokens. */
import { and, desc, eq, gt, isNull, lt } from 'drizzle-orm';
import type { Tx } from '../db';
import { invites, setupTokens } from '../db/schema';

export async function insert(tx: Tx, row: typeof invites.$inferInsert) {
	const [i] = await tx.insert(invites).values(row).returning();
	return i!;
}

/** The invite for a token hash, locked for this transaction (accepting runs once). */
export async function lockByToken(tx: Tx, tokenHash: string) {
	const [i] = await tx.select().from(invites).where(eq(invites.tokenHash, tokenHash)).for('update');
	return i ?? null;
}

export const findByToken = async (tx: Tx, tokenHash: string) =>
	(await tx.select().from(invites).where(eq(invites.tokenHash, tokenHash)))[0] ?? null;

export const findById = async (tx: Tx, id: string) =>
	(await tx.select().from(invites).where(eq(invites.id, id)))[0] ?? null;

export const markUsed = (tx: Tx, id: string, userId: string) =>
	tx.update(invites).set({ usedAt: new Date(), usedBy: userId }).where(eq(invites.id, id));

export const revoke = (tx: Tx, id: string) =>
	tx
		.update(invites)
		.set({ revokedAt: new Date() })
		.where(and(eq(invites.id, id), isNull(invites.usedAt)));

/** Unused, unrevoked, unexpired invites, newest first; all of them or one person's. */
export function pending(tx: Tx, createdBy?: string) {
	return tx
		.select()
		.from(invites)
		.where(
			and(
				isNull(invites.usedAt),
				isNull(invites.revokedAt),
				gt(invites.expiresAt, new Date()),
				createdBy ? eq(invites.createdBy, createdBy) : undefined
			)
		)
		.orderBy(desc(invites.createdAt));
}

/** Invites that expired unused before this date (used ones stay: they show who invited whom). */
export const removeStale = (tx: Tx, before: Date) =>
	tx.delete(invites).where(and(lt(invites.expiresAt, before), isNull(invites.usedAt)));

// ---- first-owner setup tokens

export async function insertSetupToken(tx: Tx, tokenHash: string, expiresAt: Date) {
	await tx.insert(setupTokens).values({ tokenHash, expiresAt });
}

export async function lockSetupToken(tx: Tx, tokenHash: string) {
	const [t] = await tx
		.select()
		.from(setupTokens)
		.where(eq(setupTokens.tokenHash, tokenHash))
		.for('update');
	return t ?? null;
}

export const findSetupToken = async (tx: Tx, tokenHash: string) =>
	(await tx.select().from(setupTokens).where(eq(setupTokens.tokenHash, tokenHash)))[0] ?? null;

export const useSetupToken = (tx: Tx, id: string) =>
	tx.update(setupTokens).set({ usedAt: new Date() }).where(eq(setupTokens.id, id));

export const removeExpiredSetupTokens = (tx: Tx) =>
	tx.delete(setupTokens).where(lt(setupTokens.expiresAt, new Date()));
