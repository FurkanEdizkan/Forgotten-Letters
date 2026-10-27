import { json } from '@sveltejs/kit';
import { api, body } from '#lib/server/http';
import { getSettings, updateSettings } from '#lib/server/services/settings';
import { settingsPatch } from '#lib/schemas/settings';

/**
 * The copy-wide settings: text size, accent, port, whether the port is locked, and the address people open.
 * Who: any signed-in account.
 * In: nothing.
 * Out: 200 { textScale, accent, port, portLocked, address }
 * Errors: 401 unauthenticated.
 */
export const GET = api(async (_event, ctx) => getSettings(ctx.host));

/**
 * Change text size, accent or port.
 * Who: owners.
 * In: { textScale?, accent?, port? } with at least one field.
 * Out: 200 { textScale, accent, port, portLocked, address }, or 202 { moveTo } when the port moved (the old port closes shortly).
 * Errors: 400 invalid, 401 unauthenticated, 403 forbidden not an owner or other site, 409 conflict port locked (Docker: APP_PORT in .env) or in use.
 */
export const PATCH = api(async (event, ctx) => {
	const { settings, moveTo } = await updateSettings(await body(event, settingsPatch), ctx);
	return moveTo ? json({ moveTo }, { status: 202 }) : settings;
});
