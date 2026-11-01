/**
 * What every compendium component of one rules version needs: the set (for links), each element's name and type
 * (link labels) and the keywords (pop-ups). Set once by the compendium layout with getters, so it follows a
 * version switch without remounting.
 */
import { createContext } from 'svelte';
import type { IdType } from '#lib/rules/pack';

export interface RulesView {
	readonly set: string;
	readonly names: Record<string, { name: string; type: IdType }>;
	readonly keywords: Record<string, { name: string; text: string }>;
}

export const [rulesView, setRulesView] = createContext<RulesView>();
