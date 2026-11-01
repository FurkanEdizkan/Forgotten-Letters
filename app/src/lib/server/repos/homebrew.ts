/**
 * Homebrew sets: homebrew.homebrew_sets, with their owner's display name. The only SQL for them, including the
 * questions other tables answer about a set: which warbands, campaigns and other sets use it.
 */
import { and, asc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { campaigns, homebrewSets, users, warbands, type HomebrewRow } from '../db/schema';

export type { HomebrewRow };
export type HomebrewView = HomebrewRow & { ownerName: string };

const view = { h: homebrewSets, ownerName: users.displayName };
const flat = (r: { h: HomebrewRow; ownerName: string }): HomebrewView => ({
	...r.h,
	ownerName: r.ownerName
});

export const insert = async (tx: Tx, row: typeof homebrewSets.$inferInsert) =>
	(await tx.insert(homebrewSets).values(row).returning())[0]!;

export async function findById(tx: Tx, id: string): Promise<HomebrewView | null> {
	const [r] = await tx
		.select(view)
		.from(homebrewSets)
		.innerJoin(users, eq(users.id, homebrewSets.ownerId))
		.where(eq(homebrewSets.id, id));
	return r ? flat(r) : null;
}

/** The row locked for a change. */
export async function lock(tx: Tx, id: string) {
	const [r] = await tx.select().from(homebrewSets).where(eq(homebrewSets.id, id)).for('update');
	return r ?? null;
}

/** My sets and everyone's shared ones (every set for `all`), by name. */
export const listFor = async (tx: Tx, userId: string, all = false) =>
	(
		await tx
			.select(view)
			.from(homebrewSets)
			.innerJoin(users, eq(users.id, homebrewSets.ownerId))
			.where(
				all
					? undefined
					: or(eq(homebrewSets.ownerId, userId), eq(homebrewSets.visibility, 'shared'))
			)
			.orderBy(sql`lower(${homebrewSets.name})`, asc(homebrewSets.id))
	).map(flat);

/** Which of `ids` this person may see: their own and the shared ones. */
export const visibleIds = async (tx: Tx, userId: string, ids: string[]) =>
	ids.length
		? (
				await tx
					.select({ id: homebrewSets.id })
					.from(homebrewSets)
					.where(
						and(
							inArray(homebrewSets.id, ids),
							or(eq(homebrewSets.ownerId, userId), eq(homebrewSets.visibility, 'shared'))
						)
					)
			).map((r) => r.id)
		: [];

export const all = (tx: Tx) => tx.select().from(homebrewSets);

/** The sets built directly on `baseSet` (a homebrew variant on a homebrew faction). */
export const builtOn = (tx: Tx, baseSet: string) =>
	tx.select().from(homebrewSets).where(eq(homebrewSets.baseSet, baseSet));

export const ofOwner = (tx: Tx, userId: string) =>
	tx.select().from(homebrewSets).where(eq(homebrewSets.ownerId, userId));

export async function update(
	tx: Tx,
	id: string,
	fields: Partial<Pick<HomebrewRow, 'name' | 'data' | 'visibility'>>,
	version?: number
) {
	const [r] = await tx
		.update(homebrewSets)
		.set({ ...fields, version: sql`${homebrewSets.version} + 1` })
		.where(
			version === undefined
				? eq(homebrewSets.id, id)
				: and(eq(homebrewSets.id, id), eq(homebrewSets.version, version))
		)
		.returning();
	return r ?? null;
}

/** Store the latest check of a set (and its new last good version); not a change of the set, so no version bump. */
export const setCheck = (
	tx: Tx,
	id: string,
	fields: Partial<Pick<HomebrewRow, 'report' | 'lastGood'>>
) => tx.update(homebrewSets).set(fields).where(eq(homebrewSets.id, id));

/** Delete sets and take them off every campaign's allow-list (an array has no foreign key to cascade). */
export async function remove(tx: Tx, ids: string[]) {
	if (!ids.length) return;
	for (const id of ids)
		await tx
			.update(campaigns)
			.set({ homebrewSets: sql`array_remove(${campaigns.homebrewSets}, ${id}::uuid)` })
			.where(sql`${id}::uuid = any(${campaigns.homebrewSets})`);
	await tx.delete(homebrewSets).where(inArray(homebrewSets.id, ids));
}

/**
 * What uses a set: warbands built on it (other than `exceptOwner`'s, when given), campaigns that allow it, and
 * homebrew sets built on it. Names only, for the refusal message.
 */
export async function usage(tx: Tx, id: string, exceptOwner?: string) {
	const setId = `hb:${id}`;
	const [wbs, camps, sets] = await Promise.all([
		tx
			.select({ name: warbands.name })
			.from(warbands)
			.where(
				and(
					sql`${setId} = any(${warbands.rulesExpansions})`,
					exceptOwner ? ne(warbands.ownerId, exceptOwner) : undefined
				)
			),
		tx
			.select({ name: campaigns.name })
			.from(campaigns)
			.where(sql`${id}::uuid = any(${campaigns.homebrewSets})`),
		tx.select({ name: homebrewSets.name }).from(homebrewSets).where(eq(homebrewSets.baseSet, setId))
	]);
	return {
		warbands: wbs.map((r) => r.name),
		campaigns: camps.map((r) => r.name),
		sets: sets.map((r) => r.name)
	};
}
