/** Campaigns and their rights (CM, co-CMs). The only SQL for campaign.campaigns and campaign.members. */
import {
	and,
	asc,
	desc,
	eq,
	gt,
	ilike,
	inArray,
	isNull,
	lt,
	ne,
	or,
	sql,
	type SQL
} from 'drizzle-orm';
import type { Tx } from '../db';
import { campaigns, members, users, type Campaign, type Role } from '../db/schema';

export type CampaignRow = Campaign;
export type MemberRole = 'cm' | 'co_cm';

export async function insert(tx: Tx, row: typeof campaigns.$inferInsert) {
	// The partial unique index on lower(name) is the only one that can conflict: null means "name taken".
	const [c] = await tx.insert(campaigns).values(row).onConflictDoNothing().returning();
	return c ?? null;
}

export const findById = async (tx: Tx, id: string) =>
	(await tx.select().from(campaigns).where(eq(campaigns.id, id)))[0] ?? null;

/** The campaign, locked for this transaction: every change to a campaign or its seats, links and requests takes
 * this lock first, so they are serialised per campaign and never deadlock. */
export async function lock(tx: Tx, id: string) {
	const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for('update');
	return c ?? null;
}

/** Whether a campaign not deleted already uses this name (ignoring case), other than `exceptId`. */
export async function nameTaken(tx: Tx, name: string, exceptId?: string) {
	const [r] = await tx
		.select({ id: campaigns.id })
		.from(campaigns)
		.where(
			and(
				sql`lower(${campaigns.name}) = lower(${name})`,
				isNull(campaigns.deletedAt),
				exceptId ? ne(campaigns.id, exceptId) : undefined
			)
		)
		.limit(1);
	return !!r;
}

/** Update and bump the version; with `version`, only if nobody changed the row since (else null). */
export async function update(
	tx: Tx,
	id: string,
	fields: Partial<
		Pick<
			Campaign,
			| 'name'
			| 'description'
			| 'stage'
			| 'visibility'
			| 'gamesPerPlayer'
			| 'startsOn'
			| 'endsOn'
			| 'houseRules'
			| 'deletedAt'
		>
	>,
	version?: number
) {
	const [c] = await tx
		.update(campaigns)
		.set({ ...fields, version: sql`${campaigns.version} + 1` })
		.where(
			version === undefined
				? eq(campaigns.id, id)
				: and(eq(campaigns.id, id), eq(campaigns.version, version))
		)
		.returning();
	return c ?? null;
}

export type Scope = 'mine' | 'listed' | 'deleted';

// Correlated subqueries are written with explicit aliases: Drizzle leaves columns unqualified in a one-table select,
// which would make "id" inside a subquery mean the inner table's id.
const C = sql.raw('"campaign"."campaigns"."id"');

const inIt = (userId: string) =>
	sql`(exists (select 1 from campaign.members m where m.campaign_id = ${C} and m.user_id = ${userId})
		or exists (select 1 from campaign.seats s where s.campaign_id = ${C} and s.user_id = ${userId}))`;

/** What a campaign card needs, from the point of view of `userId`. */
const cardFields = (userId: string) => ({
	c: campaigns,
	seatsTaken: sql<number>`(select count(s.user_id)::int from campaign.seats s where s.campaign_id = ${C})`,
	seatsTotal: sql<number>`(select count(*)::int from campaign.seats s where s.campaign_id = ${C})`,
	cmName: sql<string>`coalesce((select u.display_name from campaign.members m join auth.users u on u.id = m.user_id
		where m.campaign_id = ${C} and m.role = 'cm'), '')`,
	myRole: sql<MemberRole | null>`(select m.role from campaign.members m where m.campaign_id = ${C} and m.user_id = ${userId})`,
	mySeat: sql<boolean>`exists (select 1 from campaign.seats s where s.campaign_id = ${C} and s.user_id = ${userId})`,
	myOpenRequest: sql<boolean>`exists (select 1 from campaign.join_requests r where r.campaign_id = ${C}
		and r.user_id = ${userId} and r.status = 'open')`
});

export type CardRow = {
	c: Campaign;
	seatsTaken: number;
	seatsTotal: number;
	cmName: string;
	myRole: MemberRole | null;
	mySeat: boolean;
	myOpenRequest: boolean;
};

/**
 * A page of cards, newest first (uuidv7 ids are time-ordered, so `id` is both the order and the key):
 * mine = rights or a seat; listed = listed ones the person is not in; deleted = deleted since `deletedSince`, all of
 * them for an owner, else those the person is CM of.
 */
export function cards(
	tx: Tx,
	q: {
		userId: string;
		scope: Scope;
		owner: boolean;
		deletedSince: Date;
		after?: string;
		limit: number;
	}
): Promise<CardRow[]> {
	const scope: Record<Scope, SQL | undefined> = {
		mine: and(isNull(campaigns.deletedAt), inIt(q.userId)),
		listed: and(
			isNull(campaigns.deletedAt),
			eq(campaigns.visibility, 'listed'),
			sql`not ${inIt(q.userId)}`
		),
		deleted: and(
			gt(campaigns.deletedAt, q.deletedSince),
			q.owner
				? undefined
				: sql`exists (select 1 from campaign.members m where m.campaign_id = ${C}
					and m.user_id = ${q.userId} and m.role = 'cm')`
		)
	};
	return tx
		.select(cardFields(q.userId))
		.from(campaigns)
		.where(and(scope[q.scope], q.after ? lt(campaigns.id, q.after) : undefined))
		.orderBy(desc(campaigns.id))
		.limit(q.limit);
}

/** One card, from the point of view of `userId`. */
export async function card(tx: Tx, id: string, userId: string): Promise<CardRow | null> {
	const [r] = await tx.select(cardFields(userId)).from(campaigns).where(eq(campaigns.id, id));
	return r ?? null;
}

// ---------------------------------------------------------------- members (rights)

export const insertMember = (
	tx: Tx,
	row: { campaignId: string; userId: string; role: MemberRole }
) => tx.insert(members).values(row);

export const removeMember = (tx: Tx, campaignId: string, userId: string) =>
	tx.delete(members).where(and(eq(members.campaignId, campaignId), eq(members.userId, userId)));

export const setMemberRole = (tx: Tx, campaignId: string, userId: string, role: MemberRole) =>
	tx
		.update(members)
		.set({ role })
		.where(and(eq(members.campaignId, campaignId), eq(members.userId, userId)));

export async function roleOf(tx: Tx, campaignId: string, userId: string) {
	const [m] = await tx
		.select({ role: members.role })
		.from(members)
		.where(and(eq(members.campaignId, campaignId), eq(members.userId, userId)));
	return m?.role ?? null;
}

/** The CM first, then co-CMs by when they were added. */
export function listMembers(tx: Tx, campaignId: string) {
	return tx
		.select({
			userId: members.userId,
			displayName: users.displayName,
			siteRole: users.role,
			role: members.role
		})
		.from(members)
		.innerJoin(users, eq(users.id, members.userId))
		.where(eq(members.campaignId, campaignId))
		.orderBy(asc(members.role), asc(members.createdAt));
}

/** Every right one person holds in campaigns not deleted, or deleted since `deletedSince` (still restorable). */
export function rightsOf(tx: Tx, userId: string, deletedSince: Date) {
	return tx
		.select({
			campaignId: campaigns.id,
			name: campaigns.name,
			stage: campaigns.stage,
			role: members.role,
			deletedAt: campaigns.deletedAt
		})
		.from(members)
		.innerJoin(campaigns, eq(campaigns.id, members.campaignId))
		.where(
			and(
				eq(members.userId, userId),
				or(isNull(campaigns.deletedAt), gt(campaigns.deletedAt, deletedSince))
			)
		)
		.orderBy(asc(campaigns.name));
}

/** Drop every co-CM row a person holds (their CM rows stay). */
export const removeCoCmRowsOf = (tx: Tx, userId: string) =>
	tx.delete(members).where(and(eq(members.userId, userId), eq(members.role, 'co_cm')));

const U = sql.raw('"auth"."users"."id"');
const RIGHTS_ROLES: Role[] = ['owner', 'admin'];

/** Active Owners and Admins matching `q` (username or display name) without rights in the campaign; up to 10. */
export function coCmCandidates(tx: Tx, campaignId: string, q: string) {
	const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
	return tx
		.select({ id: users.id, displayName: users.displayName, username: users.username })
		.from(users)
		.where(
			and(
				inArray(users.role, RIGHTS_ROLES),
				isNull(users.disabledAt),
				or(ilike(users.username, like), ilike(users.displayName, like)),
				sql`not exists (select 1 from campaign.members m where m.campaign_id = ${campaignId} and m.user_id = ${U})`
			)
		)
		.orderBy(asc(users.displayName))
		.limit(10);
}

/** Remove campaigns deleted before this date; seats, links, rights and requests go with them (cascade). */
export const purgeDeleted = (tx: Tx, before: Date) =>
	tx.delete(campaigns).where(lt(campaigns.deletedAt, before)).returning({ id: campaigns.id });
