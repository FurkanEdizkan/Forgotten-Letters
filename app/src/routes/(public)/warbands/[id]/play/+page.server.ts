import { warbandSheet } from '$lib/server/sheet';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, url }) => warbandSheet(params.id, locals.user, url.searchParams.get('share'));
