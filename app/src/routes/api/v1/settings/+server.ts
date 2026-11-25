import { api, body } from '#lib/server/http';
import { getSettings, updateSettings } from '#lib/server/services/settings';
import { settingsPatch } from '#lib/schemas/settings';

/**
 * The copy-wide settings: text size and accent, and the address people open with its port (read-only).
 * Who: any signed-in account.
 * In: nothing.
 * Out: 200 { textScale, accent, port, address, portNote } (portNote: after a port fallback outside Docker, else null)
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => getSettings(ctx.host));

/**
 * Change the text size or the accent. The port is picked when the app starts, so a port field is refused.
 * Who: owners.
 * In: { textScale?, accent? } with at least one field; strict (a port or other unknown field gives 400).
 * Out: 200 { textScale, accent, port, address, portNote }
 * Errors: 400 invalid (a port field: the reason on `port`), 401 unauthenticated, 403 forbidden not an owner or other site.
 */
export const PATCH = api(async (event, ctx) =>
	updateSettings(await body(event, settingsPatch), ctx)
);
