import { error, redirect } from '@sveltejs/kit';
import { ctxOf, orPageError } from '#lib/server/http';
import * as rules from '#lib/server/services/rules';
import { COMPENDIUM_SECTIONS, type Page, type Scenario, type Table } from '#lib/rules/pack';
import { m } from '#lib/messages';
import type { PageServerLoad } from './$types';

/** The version to compare with by default: the newest older one of the same kind, else any other. */
function previous(sets: { id: string; kind: string | null; version: string | null }[], to: string) {
	const me = sets.find((s) => s.id === to);
	const older = sets
		.filter((s) => s.id !== to && s.kind === me?.kind)
		.filter((s) => (s.version ?? '').localeCompare(me?.version ?? '', 'en', { numeric: true }) < 0)
		.sort((a, b) => (b.version ?? '').localeCompare(a.version ?? '', 'en', { numeric: true }));
	return older[0]?.id ?? sets.find((s) => s.id !== to)?.id ?? null;
}

export const load: PageServerLoad = async (event) => {
	const { set, section } = event.params;
	if (section === 'warbands' || section === 'battlekit')
		redirect(303, `/rules/${encodeURIComponent(set)}/${section}`);
	if (!(COMPENDIUM_SECTIONS as readonly string[]).includes(section))
		error(404, { message: m.errors.byStatus[404]!, requestId: event.locals.requestId });
	const ctx = ctxOf(event);
	const extra = section === 'scenarios' ? 'scenario' : section === 'campaigns' ? 'table' : null;
	const els = await orPageError(
		event,
		rules.elements(ctx, set, extra ? ['page', extra] : ['page'])
	);
	const pages = els
		.filter((e) => e.type === 'page' && e.data.section === section)
		.map((e) => e.data as Page)
		.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
	let changes = null;
	if (section === 'errata') {
		const sets = (await rules.sets(ctx)).filter((s) => s.ok);
		const q = event.url.searchParams;
		const from = q.get('from') ?? previous(sets, set);
		const to = q.get('to') ?? set;
		changes = from ? await orPageError(event, rules.diff(ctx, from, to)) : null;
	}
	return {
		section,
		pages,
		scenarios: els.filter((e) => e.type === 'scenario').map((e) => e.data as Scenario),
		tables: els.filter((e) => e.type === 'table').map((e) => e.data as Table),
		changes
	};
};
