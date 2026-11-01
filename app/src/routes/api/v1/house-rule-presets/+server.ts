import { api } from '#lib/server/http';
import { requireUser } from '#lib/server/services/auth';
import { PRESETS } from '#lib/house-rule-presets';

/**
 * The house rule library: every preset with its kind, value fields and the roadmap step that uses it.
 * Who: any signed-in account.
 * In: nothing.
 * Out: 200 { items: HouseRulePreset[] }
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => {
	requireUser(ctx);
	return { items: PRESETS };
});
