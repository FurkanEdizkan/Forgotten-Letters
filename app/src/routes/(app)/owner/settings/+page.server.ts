import { formAction } from '#lib/server/http';
import { getSettings, updateSettings } from '#lib/server/services/settings';
import { settingsPatch } from '#lib/schemas/settings';
import type { Actions, PageServerLoad } from './$types';

// The owner layout guards the page; the action relies on the service's own owner check.
export const load: PageServerLoad = async (event) => ({
	settings: await getSettings(event.request.headers.get('host'))
});

export const actions = {
	/**
	 * Change the copy-wide text size, accent and port.
	 * Who: owner only.
	 * In: form settingsPatch { textScale?, accent?, port? } (at least one; the port is left out while it is locked).
	 * Out: { op: 'save', done: true, moveTo } — moveTo is the new address after a port change, else null.
	 * Errors: 400 invalid (field messages), 401 unauthenticated, 403 forbidden, 409 conflict (port locked or in use,
	 * with a message on the port field).
	 */
	save: (event) =>
		formAction(event, settingsPatch, async (patch, ctx) => {
			const { moveTo } = await updateSettings(patch, ctx);
			return { op: 'save' as const, done: true as const, moveTo };
		})
} satisfies Actions;
