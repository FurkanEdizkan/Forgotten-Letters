/**
 * The audit log: who did what, when. Services write it in the same transaction as the change; the owner reads it.
 */
import { AppError } from '../errors';
import { db, type Tx } from '../db';
import * as repo from '../repos/audit';

/** Who is acting and from where; passed from the route to every service call. */
export interface Ctx {
	actor: SessionUser | null;
	ip: string | null;
	userAgent: string | null;
	requestId: string;
}

export interface SessionUser {
	id: string;
	username: string;
	displayName: string;
	role: 'owner' | 'admin' | 'user';
	mustChangePassword: boolean;
	/** This device's session (hashed token). */
	sessionHash: string;
}

export type AuditAction =
	| 'setup.owner_created'
	| 'sign_in'
	| 'sign_in.failed'
	| 'sign_out'
	| 'sign_out.everywhere'
	| 'password.changed'
	| 'password.reset'
	| 'display_name.changed'
	| 'invite.created'
	| 'invite.revoked'
	| 'invite.accepted'
	| 'role.changed'
	| 'account.disabled'
	| 'account.enabled'
	| 'account.anonymised'
	| 'backup.downloaded'
	| 'backup.restored';

export function record(
	tx: Tx,
	ctx: Ctx,
	action: AuditAction,
	target?: { type: string; id: string } | null,
	detail?: Record<string, unknown>
) {
	return repo.insert(tx, {
		action,
		actorId: ctx.actor?.id ?? null,
		targetType: target?.type ?? null,
		targetId: target?.id ?? null,
		detail: detail ?? null,
		ip: ctx.ip,
		requestId: ctx.requestId
	});
}

/** The audit log for the owner, newest first, paged by id. */
export async function list(ctx: Ctx, opts: { before?: number; limit: number; action?: string }) {
	if (ctx.actor?.role !== 'owner')
		throw new AppError('forbidden', 'Only an owner can read the audit log.');
	const rows = await repo.page(db(), opts);
	return {
		items: rows.map((r) => ({ ...r.entry, actorName: r.actorName })),
		next: rows.length === opts.limit ? rows.at(-1)!.entry.id : null
	};
}
