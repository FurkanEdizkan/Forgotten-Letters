import { allKeywords } from '$lib/server/rules-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ keywords: await allKeywords() });
