import { editionOr } from '$lib/server/editions';
import { allKeywords } from '$lib/server/rules-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({ keywords: await allKeywords(await editionOr(url.searchParams.get('edition'))) });
