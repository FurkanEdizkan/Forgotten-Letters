/** Accounts. The only SQL for auth.users. */
import { and, asc, eq, gt, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import type { Tx } from '../db';
import { users, type Role, type User } from '../db/schema';

export type UserRow = User;

export const findById = async (tx: Tx, id: string) =>
	(await tx.select().from(users).where(eq(users.id, id)))[0] ?? null;

export const findByUsername = async (tx: Tx, username: string) =>
	(await tx.select().from(users).where(eq(users.username, username.toLowerCase())))[0] ?? null;

export async function insert(
	tx: Tx,
	row: {
		username: string;
		displayName: string;
		passwordHash: string;
		role: Role;
		invitedBy?: string | null;
	}
) {
	const [u] = await tx
		.insert(users)
		.values({ ...row, username: row.username.toLowerCase() })
		.onConflictDoNothing({ target: users.username })
		.returning();
	return u ?? null;
}

/** Update and bump the version; with `version`, only if nobody changed the row since (else null). */
export async function update(
	tx: Tx,
	id: string,
	fields: Partial<
		Pick<
			User,
			| 'displayName'
			| 'passwordHash'
			| 'role'
			| 'mustChangePassword'
			| 'disabledAt'
			| 'anonymisedAt'
			| 'lastSignInAt'
		>
	>,
	version?: number
) {
	const [u] = await tx
		.update(users)
		.set({ ...fields, version: sql`${users.version} + 1` })
		.where(
			version === undefined ? eq(users.id, id) : and(eq(users.id, id), eq(users.version, version))
		)
		.returning();
	return u ?? null;
}

/** Sign-in time, without counting as an edit (no version bump). */
export const touchSignIn = (tx: Tx, id: string) =>
	tx.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, id));

/** A page of accounts, oldest first; optionally only those one person invited. */
export function page(
	tx: Tx,
	{ after, limit, invitedBy }: { after?: string; limit: number; invitedBy?: string }
) {
	return tx
		.select()
		.from(users)
		.where(
			and(
				after ? gt(users.id, after) : undefined,
				invitedBy ? eq(users.invitedBy, invitedBy) : undefined
			)
		)
		.orderBy(asc(users.id))
		.limit(limit);
}

/**
 * Lock these accounts for an update, in id order (so two changes on the same pair never deadlock); returns the rows
 * found. A transfer locks the Owner and the new Owner together.
 */
export const lockAll = (tx: Tx, ids: string[]) =>
	tx.select().from(users).where(inArray(users.id, ids)).orderBy(asc(users.id)).for('update');

/** Who could become the Owner: active accounts (not disabled, not anonymised) other than one, up to 10. */
export function ownerCandidates(tx: Tx, q: string, notId: string) {
	const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
	return tx
		.select({
			id: users.id,
			displayName: users.displayName,
			username: users.username,
			role: users.role,
			version: users.version
		})
		.from(users)
		.where(
			and(
				ne(users.id, notId),
				isNull(users.disabledAt),
				isNull(users.anonymisedAt),
				or(ilike(users.username, like), ilike(users.displayName, like))
			)
		)
		.orderBy(asc(users.displayName))
		.limit(10);
}

export async function anyOwner(tx: Tx) {
	const [r] = await tx.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).limit(1);
	return !!r;
}
