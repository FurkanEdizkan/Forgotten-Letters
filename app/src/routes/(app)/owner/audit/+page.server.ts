import { z } from 'zod';
import { ctxOf } from '#lib/server/http';
import * as audit from '#lib/server/services/audit';
import * as people from '#lib/server/services/people';
import type { PageServerLoad } from './$types';

const query = z.object({ before: z.coerce.number().int().positive().optional() });

export const load: PageServerLoad = async (event) => {
	const ctx = ctxOf(event);
	const q = query.safeParse({ before: event.url.searchParams.get('before') ?? undefined });
	const before = q.success ? q.data.before : undefined;
	const [log, everyone] = await Promise.all([
		audit.list(ctx, { before, limit: 50 }),
		people.list(ctx, { limit: 100 })
	]);
	return {
		entries: log.items.map((e) => ({
			id: e.id,
			at: e.at,
			action: e.action,
			actorName: e.actorName,
			targetType: e.targetType,
			targetId: e.targetId,
			detail: e.detail,
			ip: e.ip
		})),
		next: log.next,
		first: !before,
		names: Object.fromEntries(everyone.items.map((p) => [p.id, p.displayName]))
	};
};
