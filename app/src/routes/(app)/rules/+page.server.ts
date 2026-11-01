import { redirect } from '@sveltejs/kit';
import { ctxOf } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { requireSignedIn } from '../guard';
import type { PageServerLoad } from './$types';

// The compendium opens on the newest loaded core version; with none loaded, the page says how to load one.
export const load: PageServerLoad = async (event) => {
	requireSignedIn(event);
	const set = await rules.defaultSet(ctxOf(event));
	if (set) redirect(303, `/rules/${encodeURIComponent(set)}/s/core-rules`);
	return { owner: event.locals.user?.role === 'owner' };
};
