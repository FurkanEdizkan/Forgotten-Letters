import { loadCustomFactions } from '$lib/server/factions';
import { loadZones } from '$lib/server/map';
import { fail } from '@sveltejs/kit';
import { importCampaign } from '$lib/server/backup';
import { publish, announceReload } from '$lib/server/hub';
import { schedule } from '$lib/server/fx';
import type { Actions } from './$types';

export const actions: Actions = {
	restore: async ({ request }) => {
		const data = await request.formData();
		if (!data.has('confirm')) return fail(400, { message: 'Tick the box to confirm replacing the campaign.' });
		const file = data.get('backup');
		if (!(file instanceof File) || file.size === 0) return fail(400, { message: 'Choose a backup file.' });
		try {
			const id = await importCampaign(JSON.parse(await file.text()));
			await loadCustomFactions();
			await loadZones();
			announceReload('factions');
			announceReload('zones');
			publish(id);
			await schedule();
		} catch (e) {
			return fail(400, { message: e instanceof SyntaxError ? 'That file is not valid JSON.' : (e as Error).message });
		}
		return { restored: true };
	}
};
