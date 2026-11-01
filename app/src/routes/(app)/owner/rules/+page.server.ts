import { z } from 'zod';
import { ctxOf, formAction } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import type { Actions, PageServerLoad } from './$types';

// The owner layout guards the page; the action relies on the service's own owner check.
export const load: PageServerLoad = async (event) => ({ sets: await rules.sets(ctxOf(event)) });

export const actions = {
	/**
	 * Read the rules folders again and replace the cache; a folder that fails its check is not loaded.
	 * Who: owners.
	 * In: form {} (nothing).
	 * Out: { op: 'reload', ok, failed } the number of folders loaded and not loaded.
	 * Errors: 401 unauthenticated, 403 forbidden not an owner.
	 */
	reload: (event) =>
		formAction(event, z.object({}), async (_input, ctx) => {
			const sets = await rules.reload(ctx);
			return {
				op: 'reload' as const,
				ok: sets.filter((s) => s.ok).length,
				failed: sets.filter((s) => !s.ok).length
			};
		})
} satisfies Actions;
