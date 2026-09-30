import { and, desc, eq, like, or, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { auditLog, user } from '$lib/server/db/schema';
import { deviceLabel } from '$lib/server/activity-rules';
import type { PageServerLoad } from './$types';

const PAGE = 100;

/** The log, newest first: account events and every admin change, filterable by kind, account and action. */
export const load: PageServerLoad = async ({ url }) => {
	const category = url.searchParams.get('category');
	const account = url.searchParams.get('account');
	const action = url.searchParams.get('action')?.trim().slice(0, 80) || null;
	const page = Math.max(0, Number(url.searchParams.get('page')) || 0);

	const where: SQL[] = [];
	if (category === 'auth' || category === 'admin') where.push(eq(auditLog.category, category));
	if (account) where.push(or(eq(auditLog.actorId, account), eq(auditLog.targetId, account))!);
	if (action) where.push(like(auditLog.action, `${action.replace(/[%_]/g, '')}%`));

	const rows = await db
		.select()
		.from(auditLog)
		.where(where.length ? and(...where) : undefined)
		.orderBy(desc(auditLog.at))
		.limit(PAGE + 1)
		.offset(page * PAGE);
	const accounts = await db.select({ id: user.id, username: user.username }).from(user).orderBy(user.username);
	return {
		filters: { category, account, action },
		page,
		more: rows.length > PAGE,
		rows: rows.slice(0, PAGE).map((r) => ({ ...r, device: deviceLabel(r.userAgent) })),
		accounts
	};
};
