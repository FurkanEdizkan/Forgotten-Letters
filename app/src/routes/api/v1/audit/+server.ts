import { api, parse } from '#lib/server/http';
import * as audit from '#lib/server/services/audit';
import { auditQuery } from '#lib/api-types';

/**
 * The audit log, newest first, optionally one action.
 * Who: owners.
 * In: query ?before=<id>&limit=<1..100, default 50>&action=<name>
 * Out: 200 { items: AuditEntry[], next }
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not an owner.
 */
export const GET = api(async (event, ctx) =>
	audit.list(ctx, parse(auditQuery, Object.fromEntries(event.url.searchParams)))
);
