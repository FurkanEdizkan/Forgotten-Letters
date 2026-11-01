import { api } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';

/**
 * Every rules folder, loaded or not, with its report (file, id, message) and its element counts per type.
 * Who: anyone signed in.
 * In: nothing.
 * Out: 200 { items: RulesSet[] }
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => ({ items: await rules.sets(ctx) }));
