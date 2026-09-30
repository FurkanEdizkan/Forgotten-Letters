import type { RequestEvent } from '@sveltejs/kit';
import { lt } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { auditLog } from './db/schema';

export type AuditEntry = typeof auditLog.$inferInsert;

/** Where a request came from: its client address (as the proxy set-up reports it) and browser. */
export function clientMeta(event: Pick<RequestEvent, 'getClientAddress' | 'request'>) {
	let ip: string | null = null;
	try {
		ip = event.getClientAddress();
	} catch {
		// adapter-node throws when ADDRESS_HEADER is configured but missing from this request.
	}
	return { ip, userAgent: event.request.headers.get('user-agent')?.slice(0, 200) ?? null };
}

/** Write one log entry without holding up the request; a failed write is reported, never thrown. */
export function recordAudit(entry: AuditEntry) {
	void db
		.insert(auditLog)
		.values(entry)
		.catch((e) => console.error('audit log:', e));
}

/** An account event from a request: the signed-in user (if any) as the actor, plus where it came from. */
export function auditAuth(
	event: Pick<RequestEvent, 'getClientAddress' | 'request' | 'locals'>,
	action: string,
	extra: Partial<AuditEntry> = {}
) {
	const u = event.locals.user;
	recordAudit({
		category: 'auth',
		action,
		actorId: u?.id ?? null,
		actorName: u?.username ?? null,
		...clientMeta(event),
		...extra
	});
}

/** Drop log entries older than AUDIT_RETENTION_DAYS (default 365). */
export async function pruneAudit() {
	const days = Number(env.AUDIT_RETENTION_DAYS) || 365;
	await db.delete(auditLog).where(lt(auditLog.at, new Date(Date.now() - days * 24 * 60 * 60 * 1000)));
}
