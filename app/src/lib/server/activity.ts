import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { session, user, userActivity } from './db/schema';
import { ActivityBuffer } from './activity-rules';

/**
 * Request counting for signed-in users. Each request only touches memory; once a minute the counts go to
 * `user_activity` (one upsert per user and day), and each account's and device's last sighting is written.
 */
const days = new ActivityBuffer();
const devices = new Map<string, { at: Date; ip: string | null }>();

export function countRequest(userId: string, sessionId: string, { ip, pageView }: { ip: string | null; pageView: boolean }) {
	const at = new Date();
	days.hit(userId, { at, ip, pageView });
	devices.set(sessionId, { at, ip });
}

export async function flushActivity() {
	const rows = days.drain();
	const seen = [...devices];
	devices.clear();
	for (const r of rows) {
		await db
			.insert(userActivity)
			.values(r)
			.onConflictDoUpdate({
				target: [userActivity.userId, userActivity.day],
				set: {
					requests: sql`${userActivity.requests} + excluded.requests`,
					pageViews: sql`${userActivity.pageViews} + excluded.page_views`,
					firstSeenAt: sql`least(${userActivity.firstSeenAt}, excluded.first_seen_at)`,
					lastSeenAt: sql`greatest(${userActivity.lastSeenAt}, excluded.last_seen_at)`,
					lastIp: sql`coalesce(excluded.last_ip, ${userActivity.lastIp})`
				}
			});
		await db
			.update(user)
			// Being seen isn't an edit: keep updatedAt as it was.
			// A Date inside raw sql is sent as its toString(): pass an ISO timestamp and cast it.
			.set({ lastSeenAt: sql`greatest(${user.lastSeenAt}, ${r.lastSeenAt.toISOString()}::timestamptz)`, updatedAt: sql`${user.updatedAt}` })
			.where(eq(user.id, r.userId));
	}
	for (const [idHash, { at, ip }] of seen)
		await db
			.update(session)
			.set({ lastSeenAt: at, ...(ip ? { lastIp: ip } : {}) })
			.where(eq(session.idHash, idHash));
}
