import { editionOr } from '$lib/server/editions';
import { allKeywords, pageIndex, rulesSummary, searchRules } from '$lib/server/rules-data';
import { FACTIONS } from '$lib/rules/factions';
import { keywordKey } from '$lib/keywords';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
	// The current edition, or one picked with ?edition=.
	const ed = await editionOr(url.searchParams.get('edition'));
	const summary = await rulesSummary(ed);
	const count = (id: string) => summary.units.find((u) => u.faction === id)?.n ?? 0;
	return {
		q,
		factions: [...FACTIONS.map((f) => ({ id: f.id, name: f.name, alignment: f.alignment as string })), { id: 'mercenaries', name: 'Mercenaries', alignment: 'any' }]
			.map((f) => ({ ...f, units: count(f.id) }))
			.filter((f) => f.units),
		keywordCount: summary.keywords,
		pages: await pageIndex(),
		results: q.length >= 2 ? await searchRules(q, ed) : null,
		glossary: q.length >= 2 ? Object.fromEntries((await allKeywords(ed)).map((k) => [keywordKey(k.name), k.text])) : {}
	};
};
