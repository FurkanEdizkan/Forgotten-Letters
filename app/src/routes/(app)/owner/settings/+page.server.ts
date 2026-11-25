import { formAction } from '#lib/server/http';
import { getSettings, runsInDocker, updateSettings } from '#lib/server/services/settings';
import { settingsPatch } from '#lib/schemas/settings';
import type { Actions, PageServerLoad } from './$types';

// The owner layout guards the page; the action relies on the service's own owner check.
export const load: PageServerLoad = async (event) => ({
	settings: await getSettings(event.request.headers.get('host')),
	inDocker: runsInDocker()
});

export const actions = {
	/**
	 * Change the copy-wide text size and accent. The port is shown read-only; it is picked when the app starts.
	 * Who: owner only.
	 * In: form settingsPatch { textScale?, accent? } (at least one).
	 * Out: { op: 'save', done: true }
	 * Errors: 400 invalid (field messages), 401 unauthenticated, 403 forbidden.
	 */
	save: (event) =>
		formAction(event, settingsPatch, async (patch, ctx) => {
			await updateSettings(patch, ctx);
			return { op: 'save' as const, done: true as const };
		})
} satisfies Actions;
