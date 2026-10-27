/**
 * Data for every page: the copy-wide look (text size and accent), which the root layout applies to <html>. Read
 * from the settings service's cache, so it costs no query per page.
 */
import { getAppearance } from '#lib/server/services/settings';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => ({ settings: await getAppearance() });
