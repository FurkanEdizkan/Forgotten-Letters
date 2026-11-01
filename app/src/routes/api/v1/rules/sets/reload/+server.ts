import { api } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';

/**
 * Read the rules folders again and replace the cache in one transaction; a folder that fails its check is not loaded.
 * Who: owners.
 * In: nothing.
 * Out: 200 { items: RulesSet[] } with each folder's report.
 * Errors: 401 unauthenticated, 403 forbidden not an owner or other site.
 */
export const POST = api(async (_event, ctx) => ({ items: await rules.reload(ctx) }));
