/**
 * Fighter-card frames (warband.card_frames): one row per faction, variant or Sin id. The only SQL for them.
 */
import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { cardFrames, type CardFrameRow } from '../db/schema';

export type { CardFrameRow };

/** Every frame, by target. */
export const list = (tx: Tx) => tx.select().from(cardFrames).orderBy(asc(cardFrames.target));

/** The frames of these targets (a warband's variant and faction). */
export const byTargets = (tx: Tx, targets: string[]) =>
	targets.length
		? tx.select().from(cardFrames).where(inArray(cardFrames.target, targets))
		: Promise.resolve([] as CardFrameRow[]);

export async function byId(tx: Tx, id: string): Promise<CardFrameRow | undefined> {
	const [row] = await tx.select().from(cardFrames).where(eq(cardFrames.id, id));
	return row;
}

export async function byTarget(tx: Tx, target: string): Promise<CardFrameRow | undefined> {
	const [row] = await tx.select().from(cardFrames).where(eq(cardFrames.target, target));
	return row;
}

/** Add a target's frame, or bump the version of the one it has (a replace). */
export async function upsert(tx: Tx, target: string, by: string): Promise<CardFrameRow> {
	const [row] = await tx
		.insert(cardFrames)
		.values({ target, updatedBy: by })
		.onConflictDoUpdate({
			target: cardFrames.target,
			set: { version: sql`${cardFrames.version} + 1`, updatedBy: by, updatedAt: sql`now()` }
		})
		.returning();
	return row!;
}

/** Remove a target's frame; the removed row, if there was one. */
export async function remove(tx: Tx, target: string): Promise<CardFrameRow | undefined> {
	const [row] = await tx.delete(cardFrames).where(eq(cardFrames.target, target)).returning();
	return row;
}
