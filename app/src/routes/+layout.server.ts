import { customFactions } from '$lib/server/factions';
import { mapInfo } from '$lib/server/map';
import { ALL_ZONES } from '$lib/rules/zones';
import type { LayoutServerLoad } from './$types';

/** Authored factions and the campaign's map travel with every page, so the browser's lists match the server's. */
export const load: LayoutServerLoad = async () => ({ customFactions: await customFactions(), map: await mapInfo(), zones: [...ALL_ZONES] });
