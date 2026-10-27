/**
 * The help and legal pages, by slug. Placeholders until their text is written step by step; any other slug is a
 * 404. Licence and the unofficial notice already carry their one-line statement.
 */
import { error } from '@sveltejs/kit';
import { m } from '#lib/messages';
import { isHelpSlug } from '#lib/ui/shell/nav';
import type { PageLoad } from './$types';

const NOTES: Partial<Record<string, string>> = {
	licence: m.help.licence,
	unofficial: m.help.unofficial
};

export const load: PageLoad = ({ params }) => {
	if (!isHelpSlug(params.page)) error(404, m.errors.byStatus[404]!);
	return { title: m.help.titles[params.page], note: NOTES[params.page] ?? null };
};
