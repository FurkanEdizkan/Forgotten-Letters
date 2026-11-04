/**
 * A rules choice as players read it (2026-11-03): the core version, then the chosen expansions' names in brackets:
 * "1.0.1", "1.0.2 (Carcass Front)", "1.0.2 (Preview)". `preview` when a chosen set is not an official release (its
 * manifest says so). A set that is not loaded shows its id.
 */
export interface SetHead {
	id: string;
	name: string;
	version: string | null;
	preview: boolean;
}
export interface RulesLabel {
	text: string;
	preview: boolean;
}

export function rulesLabel(
	sets: ReadonlyMap<string, SetHead>,
	core: string,
	expansions: readonly string[] = []
): RulesLabel {
	const head = sets.get(core)?.version ?? core;
	const names = expansions.map((e) => sets.get(e)?.name ?? e);
	return {
		text: names.length ? `${head} (${names.join(', ')})` : head,
		preview: [core, ...expansions].some((id) => !!sets.get(id)?.preview)
	};
}
