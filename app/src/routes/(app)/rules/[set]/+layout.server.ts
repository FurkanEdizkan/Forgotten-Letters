import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import * as homebrew from '#lib/server/services/homebrew';
import { isHomebrewSet, uuidOfSet } from '#lib/rules/homebrew';
import { requireSignedIn } from '../../guard';
import type { LayoutServerLoad } from './$types';

// Loaded once per version (it reads only params.set): the switcher's versions, and the names, keywords and pages
// every compendium page links to. A homebrew set whose draft has problems says that players see an older version.
export const load: LayoutServerLoad = async (event) => {
	requireSignedIn(event);
	const ctx = ctxOf(event);
	const [sets, index] = await Promise.all([
		rules.sets(ctx, true),
		orPageError(event, rules.index(ctx, event.params.set))
	]);
	const hb = isHomebrewSet(event.params.set)
		? await homebrew.get(ctx, uuidOfSet(event.params.set)).catch(() => null)
		: null;
	return {
		set: event.params.set,
		sets: sets
			.filter((s) => s.ok)
			.map(({ id, name, kind, version, base }) => ({ id, name, kind, version, base })),
		draft:
			hb && !hb.ok && hb.published
				? { since: hb.published.checkedAt, problems: hb.report, editor: `/homebrew/${hb.id}` }
				: null,
		...index
	};
};
