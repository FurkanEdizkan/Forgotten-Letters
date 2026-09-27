import { customFactions } from '$lib/server/factions';
import type { LayoutServerLoad } from './$types';

/** Authored factions travel with every page so the browser's faction list matches the server's. */
export const load: LayoutServerLoad = async () => ({ customFactions: await customFactions() });
