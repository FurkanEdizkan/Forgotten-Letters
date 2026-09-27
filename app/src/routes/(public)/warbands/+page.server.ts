import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Your warbands; the CM sees every warband. Everyone else is sent to the standings. */
export const load: PageServerLoad = async ({ locals, parent }) => {
	const { snapshot } = await parent();
	if (!locals.user) redirect(303, '/login?next=/warbands');
	const ids = locals.isAdmin ? (snapshot?.warbands.map((w) => w.id) ?? []) : locals.user.warbandIds;
	if (ids.length === 1 && !locals.isAdmin) redirect(303, `/warbands/${ids[0]}`);
	return { ids, canFound: locals.isAdmin || !ids.length };
};
