import { error } from '@sveltejs/kit';
import { allKeywords, pageIndex, rulePage } from '$lib/server/rules-data';
import { keywordKey } from '$lib/keywords';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const page = await rulePage(params.slug);
	if (!page) error(404, 'No such rules page');
	const index = (await pageIndex()).filter((p) => p.book === page.book);
	const at = index.findIndex((p) => p.slug === page.slug);
	return {
		page,
		index,
		prev: index[at - 1] ?? null,
		next: index[at + 1] ?? null,
		glossary: Object.fromEntries((await allKeywords()).map((k) => [keywordKey(k.name), k.text]))
	};
};
